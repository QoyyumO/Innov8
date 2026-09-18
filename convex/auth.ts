import { internalMutation, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  INVALID_CREDENTIALS_MESSAGE,
  MIN_PASSWORD_LENGTH,
  RESET_GENERIC_MESSAGE,
  RESET_INVALID_TOKEN_MESSAGE,
  RESET_REQUEST_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
} from "./lib/authConstants";
import { hashPassword, sha256Hex, verifyPassword } from "./lib/password";
import { publicUserValidator } from "./lib/publicUser";
import {
  createSession,
  deleteAllUserSessions,
  deleteOtherUserSessions,
  deleteSessionByToken,
  generateSessionToken,
  publicUser,
  requireSession,
  validateSessionToken,
} from "./lib/session";
import { DEMO_PASSWORD, DEMO_USERS } from "./lib/demoUsers";
import { insertCountedUser } from "./lib/facilityStats";
import { appendAuditEvent } from "./lib/services/auditLogService";

export const ensureDemoUsers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let hashedPassword: string | null = null;

    for (const user of DEMO_USERS) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", user.email))
        .first();

      if (existing) {
        continue;
      }

      hashedPassword ??= await hashPassword(DEMO_PASSWORD);
      await insertCountedUser(ctx.db, {
        email: user.email,
        hashedPassword,
        roles: user.roles,
        hospital: user.hospital,
        department: user.department,
        accountStatus: "active",
        profile: user.profile,
      });
    }

    return null;
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    keepMeLoggedIn: v.optional(v.boolean()),
  },
  returns: v.union(
    publicUserValidator.extend({
      success: v.literal(true),
      token: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", emailLower))
      .first();

    if (!user || user.accountStatus !== "active") {
      return { success: false as const, error: INVALID_CREDENTIALS_MESSAGE };
    }

    const isValidPassword = await verifyPassword(
      args.password,
      user.hashedPassword,
    );
    if (!isValidPassword) {
      return { success: false as const, error: INVALID_CREDENTIALS_MESSAGE };
    }

    const { token, sessionId } = await createSession(
      ctx,
      user._id,
      args.keepMeLoggedIn ? "persistent" : "default",
    );
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId,
      action: "UserLoggedIn",
      entity: "sessions",
      entityId: sessionId,
      details: { email: user.email },
    });

    return {
      success: true as const,
      token,
      ...publicUser(user),
    };
  },
});

export const getCurrentUser = query({
  args: {
    token: v.optional(v.string()),
  },
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx, args) => {
    if (!args.token) {
      return null;
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user || user.accountStatus !== "active") {
      return null;
    }

    return publicUser(user);
  },
});

/**
 * `createPasswordResetToken` clears this user's tokens before every insert and
 * is the only writer, so at most one row per user exists. The bound is what
 * replaces the old `.collect()` (INN-64) and is defence in case that invariant
 * ever changes - not a paging loop, which would be pretending.
 */
const RESET_TOKEN_LOOKUP_LIMIT = 100;

async function deleteUserResetTokens(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const tokens = await ctx.db
    .query("passwordResetTokens")
    .withIndex("by_userId", (query) => query.eq("userId", userId))
    .take(RESET_TOKEN_LOOKUP_LIMIT);

  for (const tokenRow of tokens) {
    await ctx.db.delete(tokenRow._id);
  }
}

async function hasRecentResetToken(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  // `_creationTime` is monotonic, so only the newest row can be inside the
  // cooldown - reading one beats reading every token the user was ever issued.
  // `by_userId` is pinned by eq(), leaving `_creationTime` as the ordering
  // field, so desc + first is the newest. Today at most one row exists
  // anyway (see above); the ordering is what keeps this right if that changes.
  const newest = await ctx.db
    .query("passwordResetTokens")
    .withIndex("by_userId", (query) => query.eq("userId", userId))
    .order("desc")
    .first();

  if (!newest) {
    return false;
  }
  return newest._creationTime > Date.now() - RESET_REQUEST_COOLDOWN_MS;
}

async function createPasswordResetToken(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string> {
  await deleteUserResetTokens(ctx, userId);

  const resetToken = generateSessionToken();
  await ctx.db.insert("passwordResetTokens", {
    userId,
    tokenHash: await sha256Hex(resetToken),
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
  });
  return resetToken;
}

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({
    success: v.literal(true),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();

    if (
      user &&
      user.accountStatus === "active" &&
      !(await hasRecentResetToken(ctx, user._id))
    ) {
      await createPasswordResetToken(ctx, user._id);
    }

    return {
      success: true as const,
      message: RESET_GENERIC_MESSAGE,
    };
  },
});

export const issuePasswordResetToken = internalMutation({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      resetToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();

    if (!user || user.accountStatus !== "active") {
      return null;
    }

    const resetToken = await createPasswordResetToken(ctx, user._id);
    return { resetToken };
  },
});

export const resetPassword = mutation({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.literal(true),
  }),
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.resetToken);
    const tokenRow = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (
      !tokenRow ||
      tokenRow.usedAt !== undefined ||
      tokenRow.expiresAt < Date.now()
    ) {
      throw new Error(RESET_INVALID_TOKEN_MESSAGE);
    }

    const user = await ctx.db.get(tokenRow.userId);
    const emailLower = args.email.toLowerCase().trim();
    if (!user || user.email !== emailLower || user.accountStatus !== "active") {
      throw new Error(RESET_INVALID_TOKEN_MESSAGE);
    }

    if (args.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    await ctx.db.patch(user._id, {
      hashedPassword: await hashPassword(args.newPassword),
    });
    await ctx.db.patch(tokenRow._id, { usedAt: Date.now() });
    await deleteAllUserSessions(ctx, user._id);
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      action: "PasswordReset",
      entity: "users",
      entityId: user._id,
      details: {},
    });
    return { success: true as const };
  },
});

export const logout = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    success: v.literal(true),
  }),
  handler: async (ctx, args) => {
    const { user, session } = await requireSession(ctx, args.token);
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "UserLoggedOut",
      entity: "sessions",
      entityId: session._id,
      details: {},
    });
    await deleteSessionByToken(ctx.db, args.token);
    return { success: true as const };
  },
});

function normalizeName(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  if (trimmed.length > 80) {
    throw new Error(`${field} is too long`);
  }
  return trimmed;
}

export const updateProfile = mutation({
  args: {
    token: v.string(),
    profile: v.object({
      firstName: v.string(),
      lastName: v.string(),
      middleName: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.literal(true),
    profile: publicUserValidator.fields.profile,
  }),
  handler: async (ctx, args) => {
    const { user, session } = await requireSession(ctx, args.token);
    const middleName = args.profile.middleName?.trim();

    const profile = {
      firstName: normalizeName(args.profile.firstName, "First name"),
      lastName: normalizeName(args.profile.lastName, "Last name"),
      ...(middleName ? { middleName: normalizeName(middleName, "Middle name") } : {}),
    };

    await ctx.db.patch(user._id, { profile });
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "ProfileUpdated",
      entity: "users",
      entityId: user._id,
      details: {},
    });
    return { success: true as const, profile };
  },
});

export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.literal(true),
  }),
  handler: async (ctx, args) => {
    const { user, session } = await requireSession(ctx, args.token);

    if (args.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    if (args.currentPassword === args.newPassword) {
      throw new Error("New password must be different from current password");
    }

    const isValidPassword = await verifyPassword(
      args.currentPassword,
      user.hashedPassword,
    );
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    await ctx.db.patch(user._id, {
      hashedPassword: await hashPassword(args.newPassword),
    });
    await deleteOtherUserSessions(ctx, user._id, args.token);
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "PasswordChanged",
      entity: "users",
      entityId: user._id,
      details: {},
    });
    return { success: true as const };
  },
});


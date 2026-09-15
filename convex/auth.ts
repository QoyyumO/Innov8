import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { hashPassword, verifyPassword } from "./lib/password";
import {
  createSession,
  deleteAllUserSessions,
  deleteOtherUserSessions,
  deleteSessionByToken,
  requireSessionUser,
  validateSessionToken,
} from "./lib/session";
import { DEMO_PASSWORD, DEMO_USERS } from "./lib/demoUsers";
import { UserRole } from "./lib/roles";

async function ensureDemoUsers(ctx: MutationCtx) {
  let hashedPassword: string | null = null;

  for (const user of DEMO_USERS) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();

    if (existing) {
      continue;
    }

    hashedPassword ??= await hashPassword(DEMO_PASSWORD);
    await ctx.db.insert("users", {
      email: user.email,
      hashedPassword,
      roles: user.roles,
      hospital: user.hospital,
      department: user.department,
      accountStatus: "active",
      profile: user.profile,
    });
  }
}

function publicUser(user: {
  _id: Id<"users">;
  email: string;
  roles: UserRole[];
  hospital: string;
  department?: string;
  accountStatus: "active" | "suspended";
  profile: { firstName: string; lastName: string; middleName?: string };
}) {
  return {
    _id: user._id,
    email: user.email,
    roles: user.roles,
    hospital: user.hospital,
    department: user.department,
    accountStatus: user.accountStatus,
    profile: user.profile,
  };
}

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureDemoUsers(ctx);

    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();

    if (!user || user.accountStatus !== "active") {
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await verifyPassword(
      args.password,
      user.hashedPassword,
    );
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    const token = await createSession(ctx.db, user._id);
    return {
      success: true,
      token,
      ...publicUser(user),
    };
  },
});

export const getCurrentUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.token) {
      return null;
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return publicUser(user);
  },
});

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();

    if (!user) {
      return {
        success: true,
        message: "If the account exists, reset instructions were sent.",
      };
    }

    return {
      success: true,
      message: "If the account exists, reset instructions were sent.",
      resetToken: "dev-reset-token",
    };
  },
});

export const resetPassword = mutation({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.resetToken !== "dev-reset-token") {
      throw new Error("Invalid or expired reset token");
    }

    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      hashedPassword: await hashPassword(args.newPassword),
    });
    await deleteAllUserSessions(ctx.db, user._id);
    return { success: true };
  },
});

export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await deleteSessionByToken(ctx.db, args.token);
    return { success: true };
  },
});

const MIN_PASSWORD_LENGTH = 6;

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
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx.db, args.token);
    const middleName = args.profile.middleName?.trim();

    const profile = {
      firstName: normalizeName(args.profile.firstName, "First name"),
      lastName: normalizeName(args.profile.lastName, "Last name"),
      ...(middleName ? { middleName: normalizeName(middleName, "Middle name") } : {}),
    };

    await ctx.db.patch(user._id, { profile });
    return { success: true, profile };
  },
});

export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx.db, args.token);

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
    await deleteOtherUserSessions(ctx.db, user._id, args.token);
    return { success: true };
  },
});

import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { Scheduler } from "convex/server";
import { internal } from "../_generated/api";
import {
  ACCOUNT_SUSPENDED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from "./authConstants";

export const SESSION_DURATION_MS = 30 * 60 * 1000;
export const PERSISTENT_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rows removed per page when clearing a user's sessions (INN-64). A password
 * reset must never fail because the account has a long login history, so the
 * helpers page instead of `.collect()`, and hand the remainder to a scheduled
 * sweep if they ever hit the page cap.
 */
export const SESSION_CLEANUP_BATCH = 100;
export const SESSION_CLEANUP_MAX_PAGES = 5;

export type SessionTtlKind = "default" | "persistent";

const SESSION_TTL_MS: Record<SessionTtlKind, number> = {
  default: SESSION_DURATION_MS,
  persistent: PERSISTENT_SESSION_DURATION_MS,
};

export function generateSessionToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a session and schedules its own deletion at `expiresAt` (INN-61,
 * INN-64). The scheduled delete is what makes expiry *reactive*: a subscribed
 * query is re-run by the write, instead of serving a cached result from
 * before the session lapsed. It also means sessions do not pile up.
 */
export async function createSession(
  ctx: { db: DatabaseWriter; scheduler: Scheduler },
  userId: Id<"users">,
  ttlKind: SessionTtlKind = "default",
): Promise<{ token: string; sessionId: Id<"sessions"> }> {
  const token = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS[ttlKind];

  const sessionId = await ctx.db.insert("sessions", {
    userId,
    token,
    expiresAt,
    createdAt: now,
  });
  await ctx.scheduler.runAt(expiresAt, internal.sessions.expireSession, {
    sessionId,
  });

  return { token, sessionId };
}

async function getUnexpiredSession(
  db: DatabaseReader,
  token: string,
): Promise<Doc<"sessions"> | null> {
  const session = await db
    .query("sessions")
    .withIndex("by_token", (query) => query.eq("token", token))
    .unique();

  // The scheduled delete (see createSession) is what ends a session for a
  // subscribed query. This clock check does NOT cover the window before that
  // job fires: `Date.now()` is not in the query's read set, so an already
  // subscribed tab is not re-evaluated and the check never runs for it. It
  // bites only on a fresh evaluation - a new subscriber, or a mutation going
  // through requireSession - which is still worth having. It is kept because
  // it is monotonically restrictive: it can only reject a session earlier
  // than the row's deletion, never keep one alive longer.
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  return session;
}

export async function validateSessionToken(
  db: DatabaseReader,
  token: string,
): Promise<Id<"users"> | null> {
  const session = await getUnexpiredSession(db, token);
  return session?.userId ?? null;
}

/**
 * Single entry point for session auth in domain functions (INN-35).
 *
 * Throws when the token is missing, unknown, or expired, when the user no
 * longer exists, or when the account is not active. Returns the session too
 * so callers can pass `session._id` to `appendAuditEvent`.
 *
 * Never authorize from a client-supplied `userId` — always go through this.
 */
export async function requireSession(
  ctx: { db: DatabaseReader },
  token: string | undefined,
): Promise<{ user: Doc<"users">; session: Doc<"sessions"> }> {
  if (!token) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const session = await getUnexpiredSession(ctx.db, token);
  if (!session) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (user.accountStatus !== "active") {
    throw new Error(ACCOUNT_SUSPENDED_MESSAGE);
  }

  return { user, session };
}

/** Client-safe user shape. Never includes `hashedPassword`. */
export function publicUser(user: Doc<"users">) {
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

export async function requireSessionUser(db: DatabaseReader, token: string) {
  const userId = await validateSessionToken(db, token);
  if (!userId) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const user = await db.get(userId);
  if (!user || user.accountStatus !== "active") {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  return user;
}

export async function deleteSessionByToken(
  db: DatabaseWriter,
  token: string,
): Promise<void> {
  const session = await db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (session) {
    await db.delete(session._id);
  }
}

/**
 * Deletes a user's sessions a page at a time, optionally keeping one token.
 * Returns true when the page cap was reached and rows may remain, so the
 * caller can schedule the rest rather than blow the transaction limits.
 */
export async function purgeUserSessions(
  db: DatabaseWriter,
  userId: Id<"users">,
  keepToken?: string,
): Promise<boolean> {
  for (let page = 0; page < SESSION_CLEANUP_MAX_PAGES; page += 1) {
    const sessions = await db
      .query("sessions")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(SESSION_CLEANUP_BATCH);

    const removable = sessions.filter((session) => session.token !== keepToken);
    if (removable.length === 0) {
      // Only the kept session is left, so another page would return it again.
      return false;
    }
    for (const session of removable) {
      await db.delete(session._id);
    }
    if (sessions.length < SESSION_CLEANUP_BATCH) {
      return false;
    }
  }
  return true;
}

export async function deleteAllUserSessions(
  ctx: { db: DatabaseWriter; scheduler: Scheduler },
  userId: Id<"users">,
): Promise<void> {
  if (await purgeUserSessions(ctx.db, userId)) {
    await ctx.scheduler.runAfter(0, internal.sessions.purgeSessionsForUser, {
      userId,
    });
  }
}

export async function deleteOtherUserSessions(
  ctx: { db: DatabaseWriter; scheduler: Scheduler },
  userId: Id<"users">,
  keepToken: string,
): Promise<void> {
  if (await purgeUserSessions(ctx.db, userId, keepToken)) {
    await ctx.scheduler.runAfter(0, internal.sessions.purgeSessionsForUser, {
      userId,
      keepToken,
    });
  }
}

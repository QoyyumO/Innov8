import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

const SESSION_DURATION_MS = 30 * 60 * 1000;

export function generateSessionToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  db: DatabaseWriter,
  userId: Id<"users">,
): Promise<{ token: string; sessionId: Id<"sessions"> }> {
  const token = generateSessionToken();
  const now = Date.now();

  const sessionId = await db.insert("sessions", {
    userId,
    token,
    expiresAt: now + SESSION_DURATION_MS,
    createdAt: now,
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

const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

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
    throw new Error("Your account is suspended. Contact your administrator.");
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
    throw new Error("Your session has expired. Please sign in again.");
  }

  const user = await db.get(userId);
  if (!user || user.accountStatus !== "active") {
    throw new Error("Your session has expired. Please sign in again.");
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

export async function deleteAllUserSessions(
  db: DatabaseWriter,
  userId: Id<"users">,
): Promise<void> {
  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    await db.delete(session._id);
  }
}

export async function deleteOtherUserSessions(
  db: DatabaseWriter,
  userId: Id<"users">,
  keepToken: string,
): Promise<void> {
  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    if (session.token !== keepToken) {
      await db.delete(session._id);
    }
  }
}

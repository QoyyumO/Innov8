import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Id } from "../_generated/dataModel";

const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  db: DatabaseWriter,
  userId: Id<"users">,
): Promise<string> {
  const token = generateSessionToken();
  const now = Date.now();

  await db.insert("sessions", {
    userId,
    token,
    expiresAt: now + SESSION_DURATION_MS,
    createdAt: now,
  });

  return token;
}

export async function validateSessionToken(
  db: DatabaseReader,
  token: string,
): Promise<Id<"users"> | null> {
  const session = await db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  return session.userId;
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

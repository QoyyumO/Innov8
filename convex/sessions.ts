import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { purgeUserSessions } from "./lib/session";

/**
 * Session lifecycle (INN-61, INN-64).
 *
 * Every session schedules its own deletion at `expiresAt` (see
 * `createSession`). That delete is a write, so a subscribed query is re-run
 * and stops serving data the moment the session lapses - a query alone would
 * not re-run just because the clock moved. `sweepExpiredSessions` is the
 * backstop for rows whose scheduled job never ran: sessions created before
 * this shipped, or a job lost to a deploy.
 */

/** Rows examined per sweep page. */
export const SESSION_SWEEP_BATCH = 200;

export const expireSession = internalMutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.literal("expired"),
    v.literal("skipped"),
    v.literal("rescheduled"),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      // Already gone: logout, password change, or a sweep got there first.
      return "skipped";
    }
    const now = Date.now();
    if (session.expiresAt > now) {
      // The row outlived its schedule (its expiry moved). Follow it rather
      // than deleting a session that is still valid.
      await ctx.scheduler.runAt(
        session.expiresAt,
        internal.sessions.expireSession,
        { sessionId: args.sessionId },
      );
      return "rescheduled";
    }
    await ctx.db.delete(args.sessionId);
    return "expired";
  },
});

/** Continues a `purgeUserSessions` that hit its page cap. */
export const purgeSessionsForUser = internalMutation({
  args: {
    userId: v.id("users"),
    keepToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await purgeUserSessions(ctx.db, args.userId, args.keepToken)) {
      await ctx.scheduler.runAfter(0, internal.sessions.purgeSessionsForUser, {
        userId: args.userId,
        keepToken: args.keepToken,
      });
    }
    return null;
  },
});

export const sweepExpiredSessions = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? SESSION_SWEEP_BATCH;
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(batchSize + 1);

    const deletable = expired.slice(0, batchSize);
    for (const session of deletable) {
      await ctx.db.delete(session._id);
    }

    const hasMore = expired.length > batchSize;
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.sessions.sweepExpiredSessions,
        { batchSize },
      );
    }
    return { deleted: deletable.length, hasMore };
  },
});

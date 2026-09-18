import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Backstop only (INN-64). Sessions normally delete themselves via the job
 * `createSession` schedules at `expiresAt`; this catches rows whose job never
 * ran - sessions created before that shipped, or a job lost to a deploy.
 *
 * The interval is short because it is an authorization boundary, not
 * housekeeping. For a session whose job was lost, nothing else re-evaluates a
 * subscribed query, so this interval is how long such a tab can keep
 * rendering records past expiry. Every live session at deploy time is in
 * exactly that state, which is why DEPLOY.md says to run the sweep once by
 * hand rather than waiting for the first tick.
 *
 * The sweep reschedules itself while rows remain, so the interval is a floor
 * on how long a missed row lingers, not a cap on how many it can clear. Two
 * sweeps overlapping is safe: they read the same range, and Convex's OCC
 * makes the loser retry against a fresh read.
 */
crons.interval(
  "sweep expired sessions",
  { minutes: 15 },
  internal.sessions.sweepExpiredSessions,
  {},
);

export default crons;

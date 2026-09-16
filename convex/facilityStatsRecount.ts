import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { FACILITY_LIST_LIMIT } from "./lib/dashboardConstants";
import { isFacilityWorker, setFacilityTotals } from "./lib/facilityStats";

/**
 * Rebuilds `facilityStats` from scratch (INN-53).
 *
 * Run once on deployments seeded before INN-53, or any time the totals look
 * wrong, while no seeding is running:
 *
 *   npx convex run facilityStatsRecount:start
 *
 * For each facility it pages through its workers (`users.by_facilityId`) and
 * then its patients (`patients.by_homeFacilityId`), carrying the running
 * count between batches, and writes each total when its pass finishes.
 * Re-running is safe: totals are set, not added.
 */

const DEFAULT_RECOUNT_BATCH_SIZE = 500;

const recountPhase = v.union(v.literal("workers"), v.literal("patients"));

export const start = internalMutation({
  args: {
    /** Rows per batch; defaults to 500. */
    batchSize: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_RECOUNT_BATCH_SIZE;
    const facilities = await ctx.db
      .query("facilities")
      .withIndex("by_code")
      .take(FACILITY_LIST_LIMIT);
    for (const facility of facilities) {
      await ctx.scheduler.runAfter(0, internal.facilityStatsRecount.recountFacility, {
        facilityId: facility._id,
        phase: "workers",
        cursor: null,
        runningCount: 0,
        batchSize,
      });
    }
    return facilities.length;
  },
});

export const recountFacility = internalMutation({
  args: {
    facilityId: v.id("facilities"),
    phase: recountPhase,
    cursor: v.union(v.string(), v.null()),
    runningCount: v.number(),
    batchSize: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pageOptions = { numItems: args.batchSize, cursor: args.cursor };
    let counted: number;
    let isDone: boolean;
    let continueCursor: string;

    if (args.phase === "workers") {
      const page = await ctx.db
        .query("users")
        .withIndex("by_facilityId", (query) => query.eq("facilityId", args.facilityId))
        .paginate(pageOptions);
      counted = page.page.filter(isFacilityWorker).length;
      ({ isDone, continueCursor } = page);
    } else {
      const page = await ctx.db
        .query("patients")
        .withIndex("by_homeFacilityId", (query) =>
          query.eq("homeFacilityId", args.facilityId),
        )
        .paginate(pageOptions);
      counted = page.page.length;
      ({ isDone, continueCursor } = page);
    }

    const runningCount = args.runningCount + counted;
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.facilityStatsRecount.recountFacility, {
        ...args,
        cursor: continueCursor,
        runningCount,
      });
      return null;
    }

    const field = args.phase === "workers" ? "workerCount" : "patientCount";
    await setFacilityTotals(ctx.db, args.facilityId, { [field]: runningCount }, Date.now());
    if (args.phase === "workers") {
      await ctx.scheduler.runAfter(0, internal.facilityStatsRecount.recountFacility, {
        facilityId: args.facilityId,
        phase: "patients",
        cursor: null,
        runningCount: 0,
        batchSize: args.batchSize,
      });
    }
    return null;
  },
});

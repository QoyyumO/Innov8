import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { linkAlertFacilities } from "./lib/facilityScope";
import { linkAuditEventFacilities } from "./lib/services/auditFacilityService";

/**
 * One-time backfill for facility-scoped admin views (INN-52).
 *
 * Alerts, grants, and audit events written before INN-52 have no facility
 * index. Run once per deployment:
 *
 *   npx convex run facilityScopeBackfill:start
 *
 * Each batch schedules the next; alerts are linked first because audit rows
 * about alerts take their facilities from `alertFacilities`. Then grants get
 * source/target copied from their request. Re-running is safe: items that
 * already have rows or facility ids are skipped.
 */

const ALERT_BATCH_SIZE = 100;
const AUDIT_BATCH_SIZE = 100;

const batchResult = v.object({ processed: v.number(), linked: v.number(), isDone: v.boolean() });

export const start = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillAlertFacilities, {
      cursor: null,
    });
    return null;
  },
});

export const backfillAlertFacilities = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: batchResult,
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("securityAlerts")
      .withIndex("by_createdAt")
      .paginate({ numItems: ALERT_BATCH_SIZE, cursor: args.cursor });

    let linked = 0;
    for (const alert of batch.page) {
      const existing = await ctx.db
        .query("alertFacilities")
        .withIndex("by_alertId", (query) => query.eq("alertId", alert._id))
        .first();
      if (existing) {
        continue;
      }
      const decision = alert.decisionId ? await ctx.db.get(alert.decisionId) : null;
      const grant = alert.emergencyAccessId ? await ctx.db.get(alert.emergencyAccessId) : null;
      const requestId = decision?.requestId ?? grant?.requestId;
      const request = requestId ? await ctx.db.get(requestId) : null;
      if (request) {
        await linkAlertFacilities(
          ctx.db,
          { alertId: alert._id, status: alert.status, createdAt: alert.createdAt },
          request,
        );
        linked += 1;
      }
    }

    if (batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillGrantFacilities, {
        cursor: null,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillAlertFacilities, {
        cursor: batch.continueCursor,
      });
    }
    return { processed: batch.page.length, linked, isDone: batch.isDone };
  },
});

export const backfillGrantFacilities = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: batchResult,
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("emergencyAccess")
      .withIndex("by_expiresAt")
      .paginate({ numItems: AUDIT_BATCH_SIZE, cursor: args.cursor });

    let linked = 0;
    for (const grant of batch.page) {
      if (grant.sourceFacilityId !== undefined && grant.targetFacilityId !== undefined) {
        continue;
      }
      const request = await ctx.db.get(grant.requestId);
      if (!request) {
        continue;
      }
      await ctx.db.patch(grant._id, {
        sourceFacilityId: request.sourceFacilityId,
        targetFacilityId: request.targetFacilityId,
      });
      linked += 1;
    }

    if (batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillAuditEventFacilities, {
        cursor: null,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillGrantFacilities, {
        cursor: batch.continueCursor,
      });
    }
    return { processed: batch.page.length, linked, isDone: batch.isDone };
  },
});

export const backfillAuditEventFacilities = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: batchResult,
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .paginate({ numItems: AUDIT_BATCH_SIZE, cursor: args.cursor });

    let linked = 0;
    for (const event of batch.page) {
      const existing = await ctx.db
        .query("auditEventFacilities")
        .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
        .first();
      if (existing) {
        continue;
      }
      await linkAuditEventFacilities(ctx.db, event);
      linked += 1;
    }

    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.facilityScopeBackfill.backfillAuditEventFacilities, {
        cursor: batch.continueCursor,
      });
    }
    return { processed: batch.page.length, linked, isDone: batch.isDone };
  },
});

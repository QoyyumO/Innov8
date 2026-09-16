import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthErrorMessage } from "./lib/authConstants";
import {
  ACTIVE_GRANT_LIMIT,
  AUDIT_TODAY_COUNT_LIMIT,
  clampDashboardSince,
  FACILITY_LIST_LIMIT,
  HARVEST_LOOKBACK_LIMIT,
  OPEN_ALERT_COUNT_LIMIT,
  RECENT_REQUEST_LIMIT,
  TODAY_COUNT_LIMIT,
} from "./lib/dashboardConstants";
import { decisionOutcome, facilityStatus, purpose } from "./lib/domain";
import { HARVEST_RECORD_COUNT } from "./lib/riskConstants";
import { AUDIT_REVIEWER_ROLES, requireClinicianSession, requireRole } from "./lib/roles";
import { requireSession } from "./lib/session";
import { isLiveGrant } from "./lib/services/emergencyAccessService";

/**
 * Live dashboards (INN-43). Every read is bounded by an index range or a
 * `.take()` cap; counts report `isCapped` instead of scanning further.
 */

const boundedCountValidator = v.object({
  count: v.number(),
  isCapped: v.boolean(),
});

const dashboardRowValidator = v.object({
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  requester: v.union(v.null(), v.object({ name: v.string(), hospital: v.string() })),
  targetFacility: v.string(),
  purpose,
  recordCount: v.number(),
  requestedAt: v.number(),
  outcome: v.union(v.null(), decisionOutcome),
  riskScore: v.union(v.null(), v.number()),
  isBreakGlass: v.boolean(),
});

const activeGrantValidator = v.object({
  grantId: v.id("emergencyAccess"),
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  holderName: v.string(),
  expiresAt: v.number(),
});

const clinicianDashboardValidator = v.object({
  today: v.object({
    total: boundedCountValidator,
    allowed: v.number(),
    challenged: v.number(),
    blocked: v.number(),
    undecided: v.number(),
  }),
  lastDecision: v.union(v.null(), dashboardRowValidator),
  latestBlockedHarvest: v.union(v.null(), dashboardRowValidator),
  activeGrants: v.array(activeGrantValidator),
  recentRequests: v.array(dashboardRowValidator),
});

const securityDashboardValidator = v.object({
  openAlerts: v.object({
    total: boundedCountValidator,
    high: v.number(),
    medium: v.number(),
    low: v.number(),
  }),
  blockedToday: boundedCountValidator,
  auditEventsToday: boundedCountValidator,
  activeGrants: v.array(activeGrantValidator),
  recentDecisions: v.array(dashboardRowValidator),
});

const facilityViewValidator = v.object({
  facilityId: v.id("facilities"),
  code: v.string(),
  name: v.string(),
  city: v.string(),
  status: facilityStatus,
});

function isAuthError(error: unknown): boolean {
  return error instanceof Error && isAuthErrorMessage(error.message);
}

function toBoundedCount(rows: unknown[], limit: number) {
  return { count: Math.min(rows.length, limit), isCapped: rows.length > limit };
}

function fullName(user: Doc<"users">): string {
  return `${user.profile.firstName} ${user.profile.lastName}`.trim();
}

/** Per-query memo so a page of rows reads each user, patient, and facility once. */
function createLoader(ctx: QueryCtx) {
  const cache = new Map<string, Promise<unknown>>();
  return <TableName extends "users" | "patients" | "facilities">(
    id: Id<TableName>,
  ): Promise<Doc<TableName> | null> => {
    const cached = cache.get(id) ?? ctx.db.get(id);
    cache.set(id, cached);
    return cached as Promise<Doc<TableName> | null>;
  };
}

type Loader = ReturnType<typeof createLoader>;

async function findDecision(ctx: QueryCtx, requestId: Id<"accessRequests">) {
  return await ctx.db
    .query("accessDecisions")
    .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
    .unique();
}

async function toDashboardRow(
  ctx: QueryCtx,
  load: Loader,
  request: Doc<"accessRequests">,
  now: number,
  knownDecision?: Doc<"accessDecisions"> | null,
) {
  const [decision, patient, requester, targetFacility, grant] = await Promise.all([
    knownDecision === undefined ? findDecision(ctx, request._id) : knownDecision,
    load(request.patientId),
    load(request.actorId),
    load(request.targetFacilityId),
    ctx.db
      .query("emergencyAccess")
      .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
      .first(),
  ]);
  return {
    requestId: request._id,
    publicId: patient?.publicId ?? "Unknown patient",
    requester: requester
      ? { name: fullName(requester), hospital: requester.hospital }
      : null,
    targetFacility: targetFacility?.name ?? "Unknown facility",
    purpose: request.purpose,
    recordCount: request.recordCount ?? 1,
    requestedAt: request.requestedAt,
    outcome: decision?.outcome ?? null,
    riskScore: decision?.riskScore ?? null,
    isBreakGlass: grant !== null && isLiveGrant(grant, now),
  };
}

async function toGrantRows(load: Loader, grants: Doc<"emergencyAccess">[]) {
  return await Promise.all(
    grants.map(async (grant) => {
      const [patient, holder] = await Promise.all([
        load(grant.patientId),
        load(grant.actorId),
      ]);
      return {
        grantId: grant._id,
        requestId: grant.requestId,
        publicId: patient?.publicId ?? "Unknown patient",
        holderName: holder ? fullName(holder) : "Unknown user",
        expiresAt: grant.expiresAt,
      };
    }),
  );
}

/** A clinician's own activity: today's outcomes, last decision, harvest, break-glass. */
export const getClinicianDashboard = query({
  args: {
    token: v.optional(v.string()),
    /** Start of the viewer's day (see `startOfLagosDay`). */
    since: v.number(),
  },
  returns: v.union(v.null(), clinicianDashboardValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requireClinicianSession(ctx, args.token)).user;
    } catch (error) {
      if (isAuthError(error)) {
        return null;
      }
      throw error;
    }
    const load = createLoader(ctx);
    const now = Date.now();
    const since = clampDashboardSince(args.since, now);

    const [newestRequests, todayRequests, newestGrants] = await Promise.all([
      ctx.db
        .query("accessRequests")
        .withIndex("by_actorId_requestedAt", (query) => query.eq("actorId", user._id))
        .order("desc")
        .take(HARVEST_LOOKBACK_LIMIT),
      ctx.db
        .query("accessRequests")
        .withIndex("by_actorId_requestedAt", (query) =>
          query.eq("actorId", user._id).gte("requestedAt", since),
        )
        .order("desc")
        .take(TODAY_COUNT_LIMIT + 1),
      ctx.db
        .query("emergencyAccess")
        .withIndex("by_actorId", (query) => query.eq("actorId", user._id))
        .order("desc")
        .take(ACTIVE_GRANT_LIMIT),
    ]);

    const todayDecisions = await Promise.all(
      todayRequests
        .slice(0, TODAY_COUNT_LIMIT)
        .map((request) => findDecision(ctx, request._id)),
    );
    const countOutcome = (outcome: Doc<"accessDecisions">["outcome"]) =>
      todayDecisions.filter((decision) => decision?.outcome === outcome).length;

    const recentRequests = await Promise.all(
      newestRequests
        .slice(0, RECENT_REQUEST_LIMIT)
        .map((request) => toDashboardRow(ctx, load, request, now)),
    );

    const harvestCandidates = newestRequests.filter(
      (request) => (request.recordCount ?? 1) >= HARVEST_RECORD_COUNT,
    );
    const harvestDecisions = await Promise.all(
      harvestCandidates.map((request) => findDecision(ctx, request._id)),
    );
    let latestBlockedHarvest = null;
    for (let index = 0; index < harvestCandidates.length; index += 1) {
      const decision = harvestDecisions[index];
      if (decision?.outcome === "BLOCK") {
        latestBlockedHarvest = await toDashboardRow(
          ctx,
          load,
          harvestCandidates[index],
          now,
          decision,
        );
        break;
      }
    }

    return {
      today: {
        total: toBoundedCount(todayRequests, TODAY_COUNT_LIMIT),
        allowed: countOutcome("ALLOW"),
        challenged: countOutcome("VERIFY"),
        blocked: countOutcome("BLOCK"),
        undecided: todayDecisions.filter((decision) => decision === null).length,
      },
      lastDecision: recentRequests.find((row) => row.outcome !== null) ?? null,
      latestBlockedHarvest,
      activeGrants: await toGrantRows(
        load,
        newestGrants.filter((grant) => isLiveGrant(grant, now)),
      ),
      recentRequests,
    };
  },
});

/** Exchange-wide view for security officers and admins. Facility scope is INN-52. */
export const getSecurityDashboard = query({
  args: {
    token: v.optional(v.string()),
    /** Start of the viewer's day (see `startOfLagosDay`). */
    since: v.number(),
  },
  returns: v.union(v.null(), securityDashboardValidator),
  handler: async (ctx, args) => {
    try {
      const { user } = await requireSession(ctx, args.token);
      requireRole(user, AUDIT_REVIEWER_ROLES);
    } catch (error) {
      if (isAuthError(error)) {
        return null;
      }
      throw error;
    }
    const load = createLoader(ctx);
    const now = Date.now();
    const since = clampDashboardSince(args.since, now);

    const [openAlerts, blockedToday, auditToday, expiringGrants, latestDecisions] =
      await Promise.all([
        ctx.db
          .query("securityAlerts")
          .withIndex("by_status", (query) => query.eq("status", "open"))
          .order("desc")
          .take(OPEN_ALERT_COUNT_LIMIT + 1),
        ctx.db
          .query("accessDecisions")
          .withIndex("by_outcome_decidedAt", (query) =>
            query.eq("outcome", "BLOCK").gte("decidedAt", since),
          )
          .take(TODAY_COUNT_LIMIT + 1),
        ctx.db
          .query("auditEvents")
          .withIndex("by_createdAt", (query) => query.gte("createdAt", since))
          .take(AUDIT_TODAY_COUNT_LIMIT + 1),
        ctx.db
          .query("emergencyAccess")
          .withIndex("by_expiresAt", (query) => query.gt("expiresAt", now))
          .take(ACTIVE_GRANT_LIMIT),
        ctx.db
          .query("accessDecisions")
          .withIndex("by_decidedAt")
          .order("desc")
          .take(RECENT_REQUEST_LIMIT),
      ]);

    const countedAlerts = openAlerts.slice(0, OPEN_ALERT_COUNT_LIMIT);
    const countSeverity = (severity: Doc<"securityAlerts">["severity"]) =>
      countedAlerts.filter((alert) => alert.severity === severity).length;

    const recentDecisions = (
      await Promise.all(
        latestDecisions.map(async (decision) => {
          const request = await ctx.db.get(decision.requestId);
          return request ? await toDashboardRow(ctx, load, request, now, decision) : null;
        }),
      )
    ).filter((row) => row !== null);

    return {
      openAlerts: {
        total: toBoundedCount(openAlerts, OPEN_ALERT_COUNT_LIMIT),
        high: countSeverity("high"),
        medium: countSeverity("medium"),
        low: countSeverity("low"),
      },
      blockedToday: toBoundedCount(blockedToday, TODAY_COUNT_LIMIT),
      auditEventsToday: toBoundedCount(auditToday, AUDIT_TODAY_COUNT_LIMIT),
      activeGrants: await toGrantRows(
        load,
        expiringGrants.filter((grant) => isLiveGrant(grant, now)),
      ),
      recentDecisions,
    };
  },
});

/** Participating hospitals, for any signed-in user. */
export const listFacilities = query({
  args: {
    token: v.optional(v.string()),
  },
  returns: v.array(facilityViewValidator),
  handler: async (ctx, args) => {
    try {
      await requireSession(ctx, args.token);
    } catch (error) {
      if (isAuthError(error)) {
        return [];
      }
      throw error;
    }
    const facilities = await ctx.db
      .query("facilities")
      .withIndex("by_code")
      .take(FACILITY_LIST_LIMIT);
    return facilities.map((facility) => ({
      facilityId: facility._id,
      code: facility.code,
      name: facility.name,
      city: facility.city,
      status: facility.status,
    }));
  },
});

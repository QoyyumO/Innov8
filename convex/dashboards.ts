import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthAppError } from "./lib/appError";
import {
  ACTIVE_GRANT_LIMIT,
  AUDIT_TODAY_COUNT_LIMIT,
  clampDashboardSince,
  FACILITY_LIST_LIMIT,
  HARVEST_LOOKBACK_LIMIT,
  OPEN_ALERT_COUNT_LIMIT,
  PATIENT_HISTORY_LIMIT,
  RECENT_REQUEST_LIMIT,
  TODAY_COUNT_LIMIT,
} from "./lib/dashboardConstants";
import { auditAction, decisionOutcome, facilityStatus, purpose, type Purpose } from "./lib/domain";
import { HARVEST_RECORD_COUNT } from "./lib/riskConstants";
import { AUDIT_REVIEWER_ROLES, requireClinicianSession, requirePatientSession, requireRole } from "./lib/roles";
import { resolveReviewerScope } from "./lib/facilityScope";
import { FacilityTotals, getFacilityTotals } from "./lib/facilityStats";
import { requireSession } from "./lib/session";
import {
  findLatestGrantForRequest,
  isLiveGrant,
} from "./lib/services/emergencyAccessService";

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
  /** Stored totals (INN-53): the exchange, or the hospital admin's facility. */
  population: v.object({ workerCount: v.number(), patientCount: v.number() }),
});

const patientHistoryEventValidator = v.object({
  eventId: v.id("auditEvents"),
  createdAt: v.number(),
  action: auditAction,
  actor: v.union(v.null(), v.object({ name: v.string(), hospital: v.string() })),
  purpose: v.union(v.null(), purpose),
});

const patientDashboardValidator = v.object({
  publicId: v.string(),
  profile: v.object({ firstName: v.string(), lastName: v.string() }),
  homeFacility: v.object({
    code: v.string(),
    name: v.string(),
    city: v.string(),
  }),
  recentEvents: v.array(patientHistoryEventValidator),
  isHistoryCapped: v.boolean(),
});

const facilityViewValidator = v.object({
  facilityId: v.id("facilities"),
  code: v.string(),
  name: v.string(),
  city: v.string(),
  status: facilityStatus,
  workerCount: v.number(),
  patientCount: v.number(),
});

const ACCESS_PURPOSES: readonly Purpose[] = [
  "treatment",
  "emergency",
  "referral",
  "follow-up",
  "administrative",
];

function purposeFromDetails(value: unknown): Purpose | null {
  if (typeof value !== "string") {
    return null;
  }
  for (const accessPurpose of ACCESS_PURPOSES) {
    if (accessPurpose === value) {
      return accessPurpose;
    }
  }
  return null;
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
    findLatestGrantForRequest(ctx.db, request._id),
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
      if (isAuthAppError(error)) {
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

/**
 * Newest requests to or from one facility, merged from the source and target
 * indexes (INN-52). Each side is capped, so the merge is bounded.
 */
async function listFacilityRequests(
  ctx: QueryCtx,
  facilityId: Id<"facilities">,
  options: { since?: number; limit: number },
): Promise<{ requests: Doc<"accessRequests">[]; isCapped: boolean }> {
  const since = options.since ?? 0;
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("accessRequests")
      .withIndex("by_sourceFacilityId_requestedAt", (query) =>
        query.eq("sourceFacilityId", facilityId).gte("requestedAt", since),
      )
      .order("desc")
      .take(options.limit + 1),
    ctx.db
      .query("accessRequests")
      .withIndex("by_targetFacilityId_requestedAt", (query) =>
        query.eq("targetFacilityId", facilityId).gte("requestedAt", since),
      )
      .order("desc")
      .take(options.limit + 1),
  ]);
  const byId = new Map<Id<"accessRequests">, Doc<"accessRequests">>();
  for (const request of [...outgoing, ...incoming]) {
    byId.set(request._id, request);
  }
  const requests = [...byId.values()].sort(
    (left, right) => right.requestedAt - left.requestedAt,
  );
  return {
    requests,
    isCapped: outgoing.length > options.limit || incoming.length > options.limit,
  };
}

/**
 * Live grants to or from one facility (INN-52), via source/target indexes
 * copied onto the grant at insert time.
 */
async function listFacilityLiveGrants(
  ctx: QueryCtx,
  facilityId: Id<"facilities">,
  now: number,
): Promise<Doc<"emergencyAccess">[]> {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("emergencyAccess")
      .withIndex("by_sourceFacilityId_expiresAt", (query) =>
        query.eq("sourceFacilityId", facilityId).gt("expiresAt", now),
      )
      .take(ACTIVE_GRANT_LIMIT + 1),
    ctx.db
      .query("emergencyAccess")
      .withIndex("by_targetFacilityId_expiresAt", (query) =>
        query.eq("targetFacilityId", facilityId).gt("expiresAt", now),
      )
      .take(ACTIVE_GRANT_LIMIT + 1),
  ]);
  const byId = new Map<Id<"emergencyAccess">, Doc<"emergencyAccess">>();
  for (const grant of [...outgoing, ...incoming]) {
    if (isLiveGrant(grant, now)) {
      byId.set(grant._id, grant);
    }
  }
  return [...byId.values()]
    .sort((left, right) => left.expiresAt - right.expiresAt)
    .slice(0, ACTIVE_GRANT_LIMIT);
}

/** Hospital-admin dashboard: the same summary, limited to one facility (INN-52). */
async function buildFacilitySecurityDashboard(
  ctx: QueryCtx,
  facilityId: Id<"facilities"> | null,
  since: number,
  now: number,
) {
  const noCount = { count: 0, isCapped: false };
  if (!facilityId) {
    return {
      openAlerts: { total: noCount, high: 0, medium: 0, low: 0 },
      blockedToday: noCount,
      auditEventsToday: noCount,
      activeGrants: [],
      recentDecisions: [],
      population: { workerCount: 0, patientCount: 0 },
    };
  }
  const load = createLoader(ctx);

  const [openLinks, auditToday, liveGrants, todayRequests, newestRequests] =
    await Promise.all([
      ctx.db
        .query("alertFacilities")
        .withIndex("by_facilityId_status_createdAt", (query) =>
          query.eq("facilityId", facilityId).eq("status", "open"),
        )
        .order("desc")
        .take(OPEN_ALERT_COUNT_LIMIT + 1),
      ctx.db
        .query("auditEventFacilities")
        .withIndex("by_facilityId_createdAt", (query) =>
          query.eq("facilityId", facilityId).gte("createdAt", since),
        )
        .take(AUDIT_TODAY_COUNT_LIMIT + 1),
      listFacilityLiveGrants(ctx, facilityId, now),
      listFacilityRequests(ctx, facilityId, { since, limit: TODAY_COUNT_LIMIT }),
      listFacilityRequests(ctx, facilityId, { limit: 2 * RECENT_REQUEST_LIMIT }),
    ]);

  const openAlerts = (
    await Promise.all(
      openLinks.slice(0, OPEN_ALERT_COUNT_LIMIT).map((link) => ctx.db.get(link.alertId)),
    )
  ).filter((alert) => alert !== null);
  const countSeverity = (severity: Doc<"securityAlerts">["severity"]) =>
    openAlerts.filter((alert) => alert.severity === severity).length;

  const todayDecisions = await Promise.all(
    todayRequests.requests.map((request) => findDecision(ctx, request._id)),
  );
  const blockedCount = todayDecisions.filter(
    (decision) => decision?.outcome === "BLOCK",
  ).length;

  const newestDecisions = await Promise.all(
    newestRequests.requests.map((request) => findDecision(ctx, request._id)),
  );
  const decidedRequests = newestRequests.requests
    .map((request, index) => ({ request, decision: newestDecisions[index] }))
    .filter((entry) => entry.decision !== null)
    .slice(0, RECENT_REQUEST_LIMIT);
  const recentDecisions = await Promise.all(
    decidedRequests.map(({ request, decision }) =>
      toDashboardRow(ctx, load, request, now, decision),
    ),
  );

  return {
    openAlerts: {
      total: toBoundedCount(openLinks, OPEN_ALERT_COUNT_LIMIT),
      high: countSeverity("high"),
      medium: countSeverity("medium"),
      low: countSeverity("low"),
    },
    blockedToday: {
      count: Math.min(blockedCount, TODAY_COUNT_LIMIT),
      isCapped: todayRequests.isCapped || blockedCount > TODAY_COUNT_LIMIT,
    },
    auditEventsToday: toBoundedCount(auditToday, AUDIT_TODAY_COUNT_LIMIT),
    activeGrants: await toGrantRows(load, liveGrants),
    recentDecisions,
    population: await getFacilityTotals(ctx.db, facilityId),
  };
}

const EMPTY_FACILITY_TOTALS: FacilityTotals = { workerCount: 0, patientCount: 0 };

/** One indexed page of stored totals (INN-53); at most FACILITY_LIST_LIMIT rows. */
async function loadFacilityStatsByFacilityId(
  ctx: QueryCtx,
): Promise<Map<Id<"facilities">, FacilityTotals>> {
  const rows = await ctx.db
    .query("facilityStats")
    .withIndex("by_facilityId")
    .take(FACILITY_LIST_LIMIT);
  const byFacilityId = new Map<Id<"facilities">, FacilityTotals>();
  for (const row of rows) {
    byFacilityId.set(row.facilityId, {
      workerCount: row.workerCount,
      patientCount: row.patientCount,
    });
  }
  return byFacilityId;
}

/** Sum of stored facility totals across the exchange (INN-53). */
async function getExchangeTotals(ctx: QueryCtx): Promise<FacilityTotals> {
  const byFacilityId = await loadFacilityStatsByFacilityId(ctx);
  let workerCount = 0;
  let patientCount = 0;
  for (const totals of byFacilityId.values()) {
    workerCount += totals.workerCount;
    patientCount += totals.patientCount;
  }
  return { workerCount, patientCount };
}

/**
 * Exchange-wide view for security officers and system admins. Hospital admins
 * get the same summary limited to their facility (INN-52).
 */
export const getSecurityDashboard = query({
  args: {
    token: v.optional(v.string()),
    /** Start of the viewer's day (see `startOfLagosDay`). */
    since: v.number(),
  },
  returns: v.union(v.null(), securityDashboardValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requireSession(ctx, args.token)).user;
      requireRole(user, AUDIT_REVIEWER_ROLES);
    } catch (error) {
      if (isAuthAppError(error)) {
        return null;
      }
      throw error;
    }
    const now = Date.now();
    const since = clampDashboardSince(args.since, now);
    const scope = await resolveReviewerScope(ctx.db, user);
    if (scope.kind === "facility") {
      return await buildFacilitySecurityDashboard(ctx, scope.facilityId, since, now);
    }
    const load = createLoader(ctx);

    const [openAlerts, blockedToday, auditToday, expiringGrants, latestDecisions] =
      await Promise.all([
        ctx.db
          .query("securityAlerts")
          .withIndex("by_status_createdAt", (query) => query.eq("status", "open"))
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
      population: await getExchangeTotals(ctx),
    };
  },
});

/** Signed-in patient's identity, home facility, and recent events that name them (INN-46). */
export const getPatientDashboard = query({
  args: {
    token: v.optional(v.string()),
  },
  returns: v.union(v.null(), patientDashboardValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requirePatientSession(ctx, args.token)).user;
    } catch (error) {
      if (isAuthAppError(error)) {
        return null;
      }
      throw error;
    }
    if (!user.patientId) {
      return null;
    }
    const patient = await ctx.db.get(user.patientId);
    if (!patient) {
      return null;
    }
    const homeFacility = await ctx.db.get(patient.homeFacilityId);
    if (!homeFacility) {
      return null;
    }

    const eventRows = await ctx.db
      .query("auditEvents")
      .withIndex("by_patientId_createdAt", (query) => query.eq("patientId", patient._id))
      .order("desc")
      .take(PATIENT_HISTORY_LIMIT + 1);
    const isHistoryCapped = eventRows.length > PATIENT_HISTORY_LIMIT;
    const events = eventRows.slice(0, PATIENT_HISTORY_LIMIT);

    const load = createLoader(ctx);
    const recentEvents = await Promise.all(
      events.map(async (event) => {
        const actor = event.actorId ? await load(event.actorId) : null;
        return {
          eventId: event._id,
          createdAt: event.createdAt,
          action: event.action,
          actor: actor ? { name: fullName(actor), hospital: actor.hospital } : null,
          purpose: purposeFromDetails(event.details.purpose),
        };
      }),
    );

    return {
      publicId: patient.publicId,
      profile: {
        firstName: patient.profile.firstName,
        lastName: patient.profile.lastName,
      },
      homeFacility: {
        code: homeFacility.code,
        name: homeFacility.name,
        city: homeFacility.city,
      },
      recentEvents,
      isHistoryCapped,
    };
  },
});

/** Participating hospitals with stored worker / patient totals (INN-53), for any signed-in user. */
export const listFacilities = query({
  args: {
    token: v.optional(v.string()),
  },
  returns: v.array(facilityViewValidator),
  handler: async (ctx, args) => {
    try {
      await requireSession(ctx, args.token);
    } catch (error) {
      if (isAuthAppError(error)) {
        return [];
      }
      throw error;
    }
    const [facilities, statsByFacilityId] = await Promise.all([
      ctx.db.query("facilities").withIndex("by_code").take(FACILITY_LIST_LIMIT),
      loadFacilityStatsByFacilityId(ctx),
    ]);
    return facilities.map((facility) => ({
      facilityId: facility._id,
      code: facility.code,
      name: facility.name,
      city: facility.city,
      status: facility.status,
      ...(statsByFacilityId.get(facility._id) ?? EMPTY_FACILITY_TOTALS),
    }));
  },
});

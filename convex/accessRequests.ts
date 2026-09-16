import { mutation, query, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthErrorMessage } from "./lib/authConstants";
import { decisionOutcome, purpose, recordType } from "./lib/domain";
import {
  ADMIN_ROLES,
  CLINICIAN_ROLES,
  SECURITY_ROLES,
  requireRole,
  userRole,
} from "./lib/roles";
import { requireSession } from "./lib/session";
import {
  normalizeRecordCount,
  normalizeRecordTypes,
  resolveAccessTarget,
} from "./lib/services/accessControlService";
import { appendAuditEvent } from "./lib/services/auditLogService";
import { scoreAccessRequest } from "./lib/services/riskScoringService";

const facilityRefValidator = v.object({
  code: v.string(),
  name: v.string(),
});

const factorsValidator = v.object({
  role: userRole,
  purpose,
  sameHospital: v.boolean(),
  recordCount: v.number(),
});

const decisionValidator = v.object({
  outcome: decisionOutcome,
  riskScore: v.number(),
  reasons: v.array(v.string()),
  decidedAt: v.number(),
  factors: v.optional(factorsValidator),
});

/** Request + decision, never clinical content. */
const accessRequestViewValidator = v.object({
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  sourceFacility: facilityRefValidator,
  targetFacility: facilityRefValidator,
  purpose,
  recordTypes: v.array(recordType),
  recordCount: v.number(),
  requestedAt: v.number(),
  isOwnRequest: v.boolean(),
  decision: v.union(v.null(), decisionValidator),
});

const createResultValidator = v.object({
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  targetFacility: facilityRefValidator,
  purpose,
  recordTypes: v.array(recordType),
  recordCount: v.number(),
  requestedAt: v.number(),
  outcome: decisionOutcome,
  riskScore: v.number(),
  reasons: v.array(v.string()),
  factors: factorsValidator,
});

const AUDIT_ACTION_BY_OUTCOME = {
  ALLOW: "AccessAllowed",
  VERIFY: "AccessChallenged",
  BLOCK: "AccessBlocked",
} as const;

const UNKNOWN_FACILITY = { code: "UNKNOWN", name: "Unknown facility" };

async function requireClinician(
  ctx: Parameters<typeof requireSession>[0],
  token: string | undefined,
) {
  const sessionContext = await requireSession(ctx, token);
  requireRole(sessionContext.user, CLINICIAN_ROLES);
  return sessionContext;
}

function isAuthError(error: unknown): boolean {
  return error instanceof Error && isAuthErrorMessage(error.message);
}

async function loadFacilityRef(
  ctx: QueryCtx,
  facilityId: Id<"facilities">,
  facilityCache: Map<Id<"facilities">, { code: string; name: string }>,
) {
  const cached = facilityCache.get(facilityId);
  if (cached) {
    return cached;
  }
  const facility = await ctx.db.get(facilityId);
  const resolved = facility
    ? { code: facility.code, name: facility.name }
    : UNKNOWN_FACILITY;
  facilityCache.set(facilityId, resolved);
  return resolved;
}

async function toRequestView(
  ctx: QueryCtx,
  request: Doc<"accessRequests">,
  viewerId: Id<"users">,
  facilityCache: Map<Id<"facilities">, { code: string; name: string }>,
) {
  const [decision, patient, sourceFacility, targetFacility] = await Promise.all([
    ctx.db
      .query("accessDecisions")
      .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
      .unique(),
    ctx.db.get(request.patientId),
    loadFacilityRef(ctx, request.sourceFacilityId, facilityCache),
    loadFacilityRef(ctx, request.targetFacilityId, facilityCache),
  ]);

  return {
    requestId: request._id,
    publicId: patient?.publicId ?? "Unknown patient",
    sourceFacility,
    targetFacility,
    purpose: request.purpose,
    recordTypes: request.recordTypes,
    recordCount: request.recordCount ?? 1,
    requestedAt: request.requestedAt,
    isOwnRequest: request.actorId === viewerId,
    decision: decision
      ? {
          outcome: decision.outcome,
          riskScore: decision.riskScore,
          reasons: decision.reasons,
          decidedAt: decision.decidedAt,
          factors: decision.factors,
        }
      : null,
  };
}

/**
 * Demo steps 3–4: store a purpose-based request, score it (INN-38),
 * store the decision, and audit both. Returns no clinical content.
 */
export const createAccessRequest = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
    purpose,
    recordTypes: v.array(recordType),
    recordCount: v.optional(v.number()),
  },
  returns: createResultValidator,
  handler: async (ctx, args) => {
    const { user, session } = await requireClinician(ctx, args.token);
    const recordTypes = normalizeRecordTypes(args.recordTypes);
    const recordCount = normalizeRecordCount(args.recordCount);
    const target = await resolveAccessTarget(
      ctx.db,
      user,
      args.publicId,
      recordTypes,
    );
    const requestedAt = Date.now();

    const requestId = await ctx.db.insert("accessRequests", {
      actorId: user._id,
      sessionId: session._id,
      patientId: target.patient._id,
      sourceFacilityId: target.sourceFacilityId,
      targetFacilityId: target.targetFacility._id,
      purpose: args.purpose,
      recordTypes,
      recordCount,
      requestedAt,
    });

    const risk = scoreAccessRequest({
      actorRoles: user.roles,
      purpose: args.purpose,
      recordTypes,
      recordCount,
      sameHospital: target.sameHospital,
      requestedAt,
      normalAccessHours: user.normalAccessHours,
      normalPatientVolume: user.normalPatientVolume,
    });

    const decisionId = await ctx.db.insert("accessDecisions", {
      requestId,
      outcome: risk.outcome,
      riskScore: risk.score,
      reasons: risk.reasons,
      decidedAt: requestedAt,
      factors: risk.factors,
    });

    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "AccessRequested",
      entity: "accessRequests",
      entityId: requestId,
      details: {
        patientPublicId: target.patient.publicId,
        purpose: args.purpose,
        recordTypes,
        recordCount,
        targetFacility: target.targetFacility.code,
      },
      createdAt: requestedAt,
    });
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: AUDIT_ACTION_BY_OUTCOME[risk.outcome],
      entity: "accessDecisions",
      entityId: decisionId,
      details: {
        requestId,
        outcome: risk.outcome,
        riskScore: risk.score,
        reasons: risk.reasons,
      },
      createdAt: requestedAt,
    });

    return {
      requestId,
      publicId: target.patient.publicId,
      targetFacility: {
        code: target.targetFacility.code,
        name: target.targetFacility.name,
      },
      purpose: args.purpose,
      recordTypes,
      recordCount,
      requestedAt,
      outcome: risk.outcome,
      riskScore: risk.score,
      reasons: risk.reasons,
      factors: risk.factors,
    };
  },
});

/** The signed-in clinician's own requests, newest first. */
export const listMyAccessRequests = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(accessRequestViewValidator),
  handler: async (ctx, args) => {
    let viewerId: Id<"users">;
    try {
      const { user } = await requireClinician(ctx, args.token);
      viewerId = user._id;
    } catch (error) {
      if (isAuthError(error)) {
        return { page: [], isDone: true, continueCursor: "" };
      }
      throw error;
    }

    const results = await ctx.db
      .query("accessRequests")
      .withIndex("by_actorId_requestedAt", (query) =>
        query.eq("actorId", viewerId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const facilityCache = new Map<
      Id<"facilities">,
      { code: string; name: string }
    >();
    const page = [];
    for (const request of results.page) {
      page.push(await toRequestView(ctx, request, viewerId, facilityCache));
    }
    return { ...results, page };
  },
});

/**
 * One request with its decision. Visible to the requester, security
 * officers, and admins; `null` for anyone else or an unknown id.
 */
export const getAccessRequest = query({
  args: {
    token: v.optional(v.string()),
    requestId: v.string(),
  },
  returns: v.union(v.null(), accessRequestViewValidator),
  handler: async (ctx, args) => {
    let viewer: Doc<"users">;
    try {
      viewer = (await requireSession(ctx, args.token)).user;
    } catch (error) {
      if (isAuthError(error)) {
        return null;
      }
      throw error;
    }

    const requestId = ctx.db.normalizeId("accessRequests", args.requestId);
    if (!requestId) {
      return null;
    }
    const request = await ctx.db.get(requestId);
    if (!request) {
      return null;
    }

    const canView =
      request.actorId === viewer._id ||
      viewer.roles.some(
        (role) => SECURITY_ROLES.includes(role) || ADMIN_ROLES.includes(role),
      );
    if (!canView) {
      return null;
    }

    return await toRequestView(ctx, request, viewer._id, new Map());
  },
});

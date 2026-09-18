import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthAppError } from "./lib/appError";
import {
  consentCheck,
  decisionOutcome,
  purpose,
  Purpose,
  recordType,
  RecordType,
} from "./lib/domain";
import { requireClinicianSession, userRole } from "./lib/roles";
import { requireSession } from "./lib/session";
import {
  assertRecordTypesAllowedForRoles,
  normalizeRecordTypes,
  resolveAccessTarget,
} from "./lib/services/accessControlService";
import { HARVEST_RECORD_COUNT } from "./lib/riskConstants";
import { allowWindowStart, allowedUntil } from "./lib/accessWindow";
import { evaluateConsent } from "./lib/services/consentService";
import { resolveReviewerScope, scopeIncludesRequest } from "./lib/facilityScope";
import { stepUpAttemptsLeft } from "./lib/services/stepUpService";
import { raiseBlockAlert } from "./lib/services/alertService";
import {
  findLatestGrantForRequest,
  toGrantView,
} from "./lib/services/emergencyAccessService";
import { appendAuditEvent } from "./lib/services/auditLogService";
import {
  BEHAVIOUR_WINDOW_MS,
  DEFAULT_PATIENT_VOLUME,
  scoreAccessRequest,
} from "./lib/services/riskScoringService";

const facilityRefValidator = v.object({
  code: v.string(),
  name: v.string(),
});

const factorsValidator = v.object({
  role: userRole,
  purpose,
  sameHospital: v.boolean(),
  recordCount: v.number(),
  consent: v.optional(consentCheck),
  locationMismatch: v.optional(v.boolean()),
  afterHours: v.optional(v.boolean()),
  recentRequestCount: v.optional(v.number()),
});

const decisionValidator = v.object({
  outcome: decisionOutcome,
  riskScore: v.number(),
  reasons: v.array(v.string()),
  decidedAt: v.number(),
  factors: v.optional(factorsValidator),
  /** ALLOW only: when the decision stops releasing records (INN-51). */
  allowedUntil: v.optional(v.number()),
  /** Step-up (INN-44): verification time, escalation time, attempts left on VERIFY. */
  verifiedAt: v.optional(v.number()),
  escalatedAt: v.optional(v.number()),
  stepUpAttemptsLeft: v.optional(v.number()),
});

const emergencyViewValidator = v.object({
  grantId: v.id("emergencyAccess"),
  grantedAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
  justification: v.string(),
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
  /** Newest break-glass grant on this request (INN-41), if any. */
  emergency: v.union(v.null(), emergencyViewValidator),
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
/** One patient per createAccessRequest. Harvest volume is INN-39. */
const SINGLE_PATIENT_RECORD_COUNT = 1;
/** A bulk export asks for every record type. */
const HARVEST_RECORD_TYPES: readonly RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
];

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
  const [decision, patient, sourceFacility, targetFacility, latestGrant] =
    await Promise.all([
      ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
        .unique(),
      ctx.db.get(request.patientId),
      loadFacilityRef(ctx, request.sourceFacilityId, facilityCache),
      loadFacilityRef(ctx, request.targetFacilityId, facilityCache),
      findLatestGrantForRequest(ctx.db, request._id),
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
          allowedUntil:
            decision.outcome === "ALLOW"
              ? allowedUntil(allowWindowStart(decision))
              : undefined,
          verifiedAt: decision.verifiedAt,
          escalatedAt: decision.escalatedAt,
          stepUpAttemptsLeft:
            decision.outcome === "VERIFY" ? stepUpAttemptsLeft(decision) : undefined,
        }
      : null,
    emergency: latestGrant ? toGrantView(latestGrant) : null,
  };
}

type AccessRequestInput = {
  publicId: string;
  purpose: Purpose;
  recordTypes: RecordType[];
  /** Always chosen on the server, never by the client. */
  recordCount: number;
  /**
   * Harvest is a volume attack (INN-39), not a pharmacist chart request.
   * Purpose-based requests always enforce the role allow-list (INN-79).
   */
  skipRoleRecordTypeCheck?: boolean;
};

/**
 * Stores a request, scores it (INN-38), stores the decision, audits both,
 * and raises a security alert on BLOCK (INN-39). Returns no clinical content.
 */
async function recordAccessRequest(
  ctx: MutationCtx,
  { user, session }: { user: Doc<"users">; session: Doc<"sessions"> },
  input: AccessRequestInput,
) {
  const recordTypes = normalizeRecordTypes(input.recordTypes);
  if (!input.skipRoleRecordTypeCheck) {
    assertRecordTypesAllowedForRoles(user.roles, recordTypes);
  }
  const recordCount = input.recordCount;
  const target = await resolveAccessTarget(
    ctx.db,
    user,
    input.publicId,
    recordTypes,
  );
  const requestedAt = Date.now();
  const sourceFacility = await ctx.db.get(target.sourceFacilityId);
  const sourcePlace = sourceFacility
    ? {
        code: sourceFacility.code,
        name: sourceFacility.name,
        city: sourceFacility.city,
      }
    : undefined;
  const location = sourcePlace?.city;
  const baseline = user.normalPatientVolume ?? DEFAULT_PATIENT_VOLUME;
  const recentRows = await ctx.db
    .query("accessRequests")
    .withIndex("by_actorId_requestedAt", (query) =>
      query
        .eq("actorId", user._id)
        .gte("requestedAt", requestedAt - BEHAVIOUR_WINDOW_MS),
    )
    .take(baseline + 1);
  const recentRequestCount = recentRows.length;

  const requestId = await ctx.db.insert("accessRequests", {
    actorId: user._id,
    sessionId: session._id,
    patientId: target.patient._id,
    sourceFacilityId: target.sourceFacilityId,
    targetFacilityId: target.targetFacility._id,
    purpose: input.purpose,
    recordTypes,
    recordCount,
    location,
    requestedAt,
  });

  const consent = await evaluateConsent(
    ctx.db,
    {
      patientId: target.patient._id,
      facilityId: target.sourceFacilityId,
      purpose: input.purpose,
      sameHospital: target.sameHospital,
      recordCount,
    },
    requestedAt,
  );

  const risk = scoreAccessRequest({
    actorRoles: user.roles,
    purpose: input.purpose,
    recordTypes,
    recordCount,
    sameHospital: target.sameHospital,
    requestedAt,
    normalAccessHours: user.normalAccessHours,
    normalPatientVolume: user.normalPatientVolume,
    consent,
    location,
    sourceFacility: sourcePlace,
    recentRequestCount,
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
      purpose: input.purpose,
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

  if (risk.outcome === "BLOCK") {
    await raiseBlockAlert(ctx.db, {
      requestId,
      decisionId,
      actor: user,
      sessionId: session._id,
      patientPublicId: target.patient.publicId,
      recordCount,
      riskScore: risk.score,
      reasons: risk.reasons,
      createdAt: requestedAt,
    });
  }

  return {
    requestId,
    publicId: target.patient.publicId,
    targetFacility: {
      code: target.targetFacility.code,
      name: target.targetFacility.name,
    },
    purpose: input.purpose,
    recordTypes,
    recordCount,
    requestedAt,
    outcome: risk.outcome,
    riskScore: risk.score,
    reasons: risk.reasons,
    factors: risk.factors,
  };
}

/**
 * Demo steps 3–4: one purpose-based request for one patient.
 * Returns no clinical content.
 */
export const createAccessRequest = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
    purpose,
    recordTypes: v.array(recordType),
  },
  returns: createResultValidator,
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    return await recordAccessRequest(ctx, sessionContext, {
      publicId: args.publicId,
      purpose: args.purpose,
      recordTypes: args.recordTypes,
      recordCount: SINGLE_PATIENT_RECORD_COUNT,
    });
  },
});

/**
 * Demo step 6 (INN-39): the signed-in clinician suddenly asks for a bulk
 * export. The server fixes the volume at HARVEST_RECORD_COUNT and stores one
 * request row (the §14 seed convention), so the client never picks a count
 * or a score. The risk engine blocks it and the alert service reports it.
 */
export const simulateBulkHarvest = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
  },
  returns: createResultValidator,
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    return await recordAccessRequest(ctx, sessionContext, {
      publicId: args.publicId,
      purpose: "treatment",
      recordTypes: [...HARVEST_RECORD_TYPES],
      recordCount: HARVEST_RECORD_COUNT,
      skipRoleRecordTypeCheck: true,
    });
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
      const { user } = await requireClinicianSession(ctx, args.token);
      viewerId = user._id;
    } catch (error) {
      if (isAuthAppError(error)) {
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
    const page = await Promise.all(
      results.page.map((request) =>
        toRequestView(ctx, request, viewerId, facilityCache),
      ),
    );
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
      if (isAuthAppError(error)) {
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
      scopeIncludesRequest(await resolveReviewerScope(ctx.db, viewer), request);
    if (!canView) {
      return null;
    }

    return await toRequestView(ctx, request, viewer._id, new Map());
  },
});

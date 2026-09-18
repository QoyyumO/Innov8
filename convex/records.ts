import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { decisionOutcome, recordType } from "./lib/domain";
import { requireClinicianSession } from "./lib/roles";
import { appendAuditEvent } from "./lib/services/auditLogService";
import {
  loadTargetSummary,
  pickAuthorisedSections,
  resolveViewAuthorisation,
} from "./lib/services/recordExchangeService";

const facilityRefValidator = v.object({
  code: v.string(),
  name: v.string(),
});

const sectionsValidator = v.object({
  medicalSummary: v.optional(v.string()),
  allergies: v.optional(v.array(v.string())),
  medications: v.optional(v.array(v.string())),
  diagnoses: v.optional(v.array(v.string())),
  labResults: v.optional(v.array(v.string())),
});

const viewResultValidator = v.union(
  v.null(),
  v.object({
    status: v.literal("authorised"),
    grantedBy: v.union(v.literal("decision"), v.literal("emergency")),
    emergencyExpiresAt: v.optional(v.number()),
    /** When an ALLOW decision stops releasing records (INN-51). */
    allowedUntil: v.optional(v.number()),
    publicId: v.string(),
    facility: facilityRefValidator,
    recordTypes: v.array(recordType),
    sections: sectionsValidator,
    summaryUpdatedAt: v.number(),
  }),
  v.object({
    status: v.literal("unavailable"),
    publicId: v.string(),
    facility: facilityRefValidator,
  }),
  v.object({
    status: v.literal("denied"),
    outcome: v.union(v.null(), decisionOutcome),
    riskScore: v.union(v.null(), v.number()),
    reasons: v.array(v.string()),
    /** Set when the request was allowed but its window has passed. */
    expiredAt: v.optional(v.number()),
  }),
);

/**
 * Demo step 5: release only the requested record types from the target
 * facility, and only to the clinician who made an allowed request that is
 * still inside its window (or holds a live emergency grant on it). A
 * mutation, because every successful view writes `RecordViewed` and every
 * attempt on an expired ALLOW writes `AccessExpired`.
 */
export const viewAuthorisedSummary = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.string(),
  },
  returns: viewResultValidator,
  handler: async (ctx, args) => {
    const { user, session } = await requireClinicianSession(ctx, args.token);

    const requestId = ctx.db.normalizeId("accessRequests", args.requestId);
    const request = requestId ? await ctx.db.get(requestId) : null;
    if (!request || request.actorId !== user._id) {
      return null;
    }

    const now = Date.now();
    const authorisation = await resolveViewAuthorisation(ctx.db, request, now);
    const patient = await ctx.db.get(request.patientId);
    const publicId = patient?.publicId ?? "Unknown patient";

    if (!authorisation.isAuthorised) {
      if (authorisation.expiredAt !== undefined) {
        await appendAuditEvent(ctx.db, {
          actorId: user._id,
          sessionId: session._id,
          action: "AccessExpired",
          entity: "accessRequests",
          entityId: request._id,
          details: {
            patientPublicId: publicId,
            recordTypes: request.recordTypes,
            expiredAt: authorisation.expiredAt,
          },
          createdAt: now,
        });
      }
      return {
        status: "denied" as const,
        outcome: authorisation.outcome,
        riskScore: authorisation.riskScore,
        reasons: authorisation.reasons,
        expiredAt: authorisation.expiredAt,
      };
    }

    const facility = await ctx.db.get(request.targetFacilityId);
    const facilityRef = facility
      ? { code: facility.code, name: facility.name }
      : { code: "UNKNOWN", name: "Unknown facility" };

    const summary = await loadTargetSummary(
      ctx.db,
      request.patientId,
      request.targetFacilityId,
    );
    if (!summary) {
      return { status: "unavailable" as const, publicId, facility: facilityRef };
    }

    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "RecordViewed",
      entity: "clinicalSummaries",
      entityId: summary._id,
      details: {
        requestId: request._id,
        patientPublicId: publicId,
        facility: facilityRef.code,
        recordTypes: request.recordTypes,
        grantedBy: authorisation.grantedBy,
      },
      createdAt: now,
    });

    return {
      status: "authorised" as const,
      grantedBy: authorisation.grantedBy,
      emergencyExpiresAt:
        authorisation.grantedBy === "emergency"
          ? authorisation.emergencyExpiresAt
          : undefined,
      allowedUntil:
        authorisation.grantedBy === "decision" ? authorisation.allowedUntil : undefined,
      publicId,
      facility: facilityRef,
      recordTypes: request.recordTypes,
      sections: pickAuthorisedSections(summary, request.recordTypes),
      summaryUpdatedAt: summary.updatedAt,
    };
  },
});

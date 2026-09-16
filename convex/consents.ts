import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthErrorMessage } from "./lib/authConstants";
import { CONSENT_LIST_LIMIT, CONSENT_NOT_FOUND_MESSAGE } from "./lib/consentConstants";
import { consentStatus } from "./lib/domain";
import { resolveReviewerScope } from "./lib/facilityScope";
import { AUDIT_REVIEWER_ROLES, requireClinicianSession, requireRole } from "./lib/roles";
import { requireSession } from "./lib/session";
import {
  findActiveConsent,
  isConsentLive,
  recordConsent,
  resolveConsentContext,
  revokeConsent,
} from "./lib/services/consentService";

/** Consent API (INN-45). No clinical content is returned. */

const consentViewValidator = v.object({
  consentId: v.id("consents"),
  publicId: v.string(),
  facility: v.string(),
  patientFacility: v.string(),
  status: consentStatus,
  isLive: v.boolean(),
  note: v.string(),
  recordedBy: v.union(v.null(), v.string()),
  grantedAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.union(v.null(), v.number()),
});

function isAuthError(error: unknown): boolean {
  return error instanceof Error && isAuthErrorMessage(error.message);
}

async function toConsentView(ctx: QueryCtx, consent: Doc<"consents">, now: number) {
  const [patient, facility, patientFacility, recorder] = await Promise.all([
    ctx.db.get(consent.patientId),
    ctx.db.get(consent.facilityId),
    ctx.db.get(consent.patientFacilityId),
    consent.recordedBy ? ctx.db.get(consent.recordedBy) : null,
  ]);
  return {
    consentId: consent._id,
    publicId: patient?.publicId ?? "Unknown patient",
    facility: facility?.name ?? "Unknown facility",
    patientFacility: patientFacility?.name ?? "Unknown facility",
    status: consent.status,
    isLive: isConsentLive(consent, now),
    note: consent.note,
    recordedBy: recorder
      ? `${recorder.profile.firstName} ${recorder.profile.lastName}`.trim()
      : null,
    grantedAt: consent.grantedAt,
    expiresAt: consent.expiresAt,
    revokedAt: consent.revokedAt ?? null,
  };
}

/** Whether the caller's facility needs, and has, consent for this patient. */
export const getConsentStatus = query({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      isRequired: v.boolean(),
      facility: v.string(),
      patientFacility: v.string(),
      consent: v.union(v.null(), consentViewValidator),
    }),
  ),
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
    let context;
    try {
      context = await resolveConsentContext(ctx.db, user, args.publicId);
    } catch {
      return null;
    }
    const now = Date.now();
    const [facility, patientFacility, consent] = await Promise.all([
      ctx.db.get(context.facilityId),
      ctx.db.get(context.patientFacilityId),
      context.isRequired
        ? findActiveConsent(ctx.db, context.patient._id, context.facilityId, now)
        : null,
    ]);
    return {
      isRequired: context.isRequired,
      facility: facility?.name ?? "Unknown facility",
      patientFacility: patientFacility?.name ?? "Unknown facility",
      consent: consent ? await toConsentView(ctx, consent, now) : null,
    };
  },
});

/** A clinician records the patient's consent for their own facility (30 days). */
export const recordPatientConsent = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
    note: v.string(),
  },
  returns: v.object({ consentId: v.id("consents"), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    const consent = await recordConsent(
      ctx.db,
      sessionContext,
      { publicId: args.publicId, note: args.note },
      Date.now(),
    );
    return { consentId: consent._id, expiresAt: consent.expiresAt };
  },
});

/** Security officers and admins (scoped, INN-52) revoke a consent. */
export const revokePatientConsent = mutation({
  args: {
    token: v.optional(v.string()),
    consentId: v.string(),
  },
  returns: v.object({ consentId: v.id("consents"), revokedAt: v.number() }),
  handler: async (ctx, args) => {
    const sessionContext = await requireSession(ctx, args.token);
    requireRole(sessionContext.user, AUDIT_REVIEWER_ROLES);
    const consentId = ctx.db.normalizeId("consents", args.consentId);
    if (!consentId) {
      throw new Error(CONSENT_NOT_FOUND_MESSAGE);
    }
    const consent = await revokeConsent(ctx.db, sessionContext, consentId, Date.now());
    return { consentId, revokedAt: consent.revokedAt ?? Date.now() };
  },
});

/** Newest consents for reviewers: all for global reviewers, their facility for hospital admins. */
export const listConsents = query({
  args: {
    token: v.optional(v.string()),
  },
  returns: v.array(consentViewValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requireSession(ctx, args.token)).user;
      requireRole(user, AUDIT_REVIEWER_ROLES);
    } catch (error) {
      if (isAuthError(error)) {
        return [];
      }
      throw error;
    }
    const scope = await resolveReviewerScope(ctx.db, user);
    let consents: Doc<"consents">[];
    if (scope.kind === "global") {
      consents = await ctx.db
        .query("consents")
        .withIndex("by_grantedAt")
        .order("desc")
        .take(CONSENT_LIST_LIMIT);
    } else if (scope.kind === "facility" && scope.facilityId) {
      const facilityId: Id<"facilities"> = scope.facilityId;
      const [held, granted] = await Promise.all([
        ctx.db
          .query("consents")
          .withIndex("by_facilityId_grantedAt", (query) => query.eq("facilityId", facilityId))
          .order("desc")
          .take(CONSENT_LIST_LIMIT),
        ctx.db
          .query("consents")
          .withIndex("by_patientFacilityId_grantedAt", (query) =>
            query.eq("patientFacilityId", facilityId),
          )
          .order("desc")
          .take(CONSENT_LIST_LIMIT),
      ]);
      const byId = new Map<Id<"consents">, Doc<"consents">>();
      for (const consent of [...held, ...granted]) {
        byId.set(consent._id, consent);
      }
      consents = [...byId.values()]
        .sort((left, right) => right.grantedAt - left.grantedAt)
        .slice(0, CONSENT_LIST_LIMIT);
    } else {
      consents = [];
    }
    const now = Date.now();
    return await Promise.all(consents.map((consent) => toConsentView(ctx, consent, now)));
  },
});

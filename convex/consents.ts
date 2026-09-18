import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAppErrorCode, isAuthAppError } from "./lib/appError";
import {
  NO_INDEXED_RECORDS_CODE,
  NO_SOURCE_FACILITY_CODE,
  PATIENT_NOT_FOUND_CODE,
} from "./lib/accessRequestMessages";
import { CONSENT_LIST_LIMIT } from "./lib/consentConstants";
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

function isConsentContextError(error: unknown): boolean {
  return (
    isAppErrorCode(error, PATIENT_NOT_FOUND_CODE) ||
    isAppErrorCode(error, NO_SOURCE_FACILITY_CODE) ||
    isAppErrorCode(error, NO_INDEXED_RECORDS_CODE)
  );
}

type ConsentViewCache = {
  patients: Map<Id<"patients">, Promise<Doc<"patients"> | null>>;
  facilities: Map<Id<"facilities">, Promise<Doc<"facilities"> | null>>;
  users: Map<Id<"users">, Promise<Doc<"users"> | null>>;
};

function createConsentViewCache(): ConsentViewCache {
  return {
    patients: new Map(),
    facilities: new Map(),
    users: new Map(),
  };
}

function loadCached<TableName extends "patients" | "facilities" | "users">(
  ctx: QueryCtx,
  cache: Map<Id<TableName>, Promise<Doc<TableName> | null>>,
  documentId: Id<TableName>,
): Promise<Doc<TableName> | null> {
  const existing = cache.get(documentId);
  if (existing) {
    return existing;
  }
  const loaded = ctx.db.get(documentId);
  cache.set(documentId, loaded);
  return loaded;
}

async function toConsentView(
  ctx: QueryCtx,
  consent: Doc<"consents">,
  now: number,
  cache: ConsentViewCache,
) {
  const [patient, facility, patientFacility, recorder] = await Promise.all([
    loadCached(ctx, cache.patients, consent.patientId),
    loadCached(ctx, cache.facilities, consent.facilityId),
    loadCached(ctx, cache.facilities, consent.patientFacilityId),
    consent.recordedBy ? loadCached(ctx, cache.users, consent.recordedBy) : null,
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
      if (isAuthAppError(error)) {
        return null;
      }
      throw error;
    }
    let context;
    try {
      context = await resolveConsentContext(ctx.db, user, args.publicId);
    } catch (error) {
      if (isConsentContextError(error)) {
        return null;
      }
      throw error;
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
      consent: consent
        ? await toConsentView(ctx, consent, now, createConsentViewCache())
        : null,
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
    consentId: v.id("consents"),
  },
  returns: v.object({ consentId: v.id("consents"), revokedAt: v.number() }),
  handler: async (ctx, args) => {
    const sessionContext = await requireSession(ctx, args.token);
    requireRole(sessionContext.user, AUDIT_REVIEWER_ROLES);
    const consent = await revokeConsent(ctx.db, sessionContext, args.consentId, Date.now());
    return { consentId: args.consentId, revokedAt: consent.revokedAt ?? Date.now() };
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
      if (isAuthAppError(error)) {
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
      const [grantedToFacility, recordsHeldAt] = await Promise.all([
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
      for (const consent of [...grantedToFacility, ...recordsHeldAt]) {
        byId.set(consent._id, consent);
      }
      consents = [...byId.values()]
        .sort((left, right) => right.grantedAt - left.grantedAt)
        .slice(0, CONSENT_LIST_LIMIT);
    } else {
      consents = [];
    }
    const now = Date.now();
    const cache = createConsentViewCache();
    return await Promise.all(
      consents.map((consent) => toConsentView(ctx, consent, now, cache)),
    );
  },
});

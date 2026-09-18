import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { personName, recordType } from "./lib/domain";
import { requireClinicianSession } from "./lib/roles";
import { isAuthAppError } from "./lib/appError";
import { appendAuditEvent } from "./lib/services/auditLogService";
import {
  findPatientsByQuery,
  getPatientDiscoveryByPublicId,
} from "./lib/services/patientDiscoveryService";
import { isSearchableQuery } from "./lib/searchLimits";

const facilityRefValidator = v.object({
  code: v.string(),
  name: v.string(),
});

const patientSearchHitValidator = v.object({
  publicId: v.string(),
  profile: personName,
  homeFacility: facilityRefValidator,
});

const patientDiscoveryValidator = patientSearchHitValidator.extend({
  recordsByFacility: v.array(
    v.object({
      code: v.string(),
      name: v.string(),
      recordTypes: v.array(recordType),
    }),
  ),
});

/**
 * Search writes `PatientSearched`, so it is a mutation.
 * Discovery stays a query so the detail page can live-update; the page also
 * calls `recordPatientDiscovery` once per session and publicId (INN-69).
 */
export const searchPatients = mutation({
  args: {
    token: v.optional(v.string()),
    query: v.string(),
  },
  returns: v.array(patientSearchHitValidator),
  handler: async (ctx, args) => {
    const { user, session } = await requireClinicianSession(ctx, args.token);
    const results = await findPatientsByQuery(ctx.db, args.query);
    const trimmedQuery = args.query.trim();

    // Audit every query that reached an index, hit or miss: walking
    // PAT-000001, PAT-000002, ... is the enumeration the trail exists to
    // catch. Queries rejected before any lookup are not searches.
    if (isSearchableQuery(trimmedQuery)) {
      await appendAuditEvent(ctx.db, {
        actorId: user._id,
        sessionId: session._id,
        action: "PatientSearched",
        entity: "patients",
        entityId: results[0]?.publicId,
        details: {
          query: trimmedQuery,
          resultCount: results.length,
          publicIds: results.map((hit) => hit.publicId),
        },
      });
    }

    return results;
  },
});

export const getPatientDiscovery = query({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
  },
  returns: v.union(v.null(), patientDiscoveryValidator),
  handler: async (ctx, args) => {
    if (!args.token) {
      return null;
    }

    try {
      await requireClinicianSession(ctx, args.token);
    } catch (error) {
      if (isAuthAppError(error)) {
        return null;
      }
      throw error;
    }

    return await getPatientDiscoveryByPublicId(ctx.db, args.publicId);
  },
});

/**
 * One `PatientDiscovered` row per session and publicId, including misses
 * (INN-69). Dedup is server-side so a Strict Mode remount does not double-write.
 */
export const recordPatientDiscovery = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
  },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, session } = await requireClinicianSession(ctx, args.token);
    const publicId = args.publicId.trim();
    if (publicId === "") {
      return { recorded: false };
    }

    const existing = await ctx.db
      .query("auditEvents")
      .withIndex("by_sessionId_action_entityId", (query) =>
        query
          .eq("sessionId", session._id)
          .eq("action", "PatientDiscovered")
          .eq("entityId", publicId),
      )
      .first();
    if (existing) {
      return { recorded: false };
    }

    const discovery = await getPatientDiscoveryByPublicId(ctx.db, publicId);
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "PatientDiscovered",
      entity: "patients",
      entityId: publicId,
      details: {
        publicId,
        found: discovery !== null,
      },
    });
    return { recorded: true };
  },
});

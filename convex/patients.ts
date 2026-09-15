import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { personName, recordType } from "./lib/domain";
import { requireSession } from "./lib/session";
import { CLINICIAN_ROLES, requireRole } from "./lib/roles";
import { appendAuditEvent } from "./lib/services/auditLogService";
import {
  findPatientsByQuery,
  getPatientDiscoveryByPublicId,
} from "./lib/services/patientDiscoveryService";

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

async function requireClinicianSession(
  ctx: Parameters<typeof requireSession>[0],
  token: string | undefined,
) {
  const { user, session } = await requireSession(ctx, token);
  requireRole(user, CLINICIAN_ROLES);
  return { user, session };
}

/**
 * Search writes `PatientSearched`, so it is a mutation.
 * Discovery is a query so the detail page can use `useQuery` without
 * auditing twice on React Strict Mode remounts.
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

    if (results.length > 0) {
      await appendAuditEvent(ctx.db, {
        actorId: user._id,
        sessionId: session._id,
        action: "PatientSearched",
        entity: "patients",
        entityId: results[0].publicId,
        details: {
          query: args.query.trim(),
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
    } catch {
      return null;
    }

    return await getPatientDiscoveryByPublicId(ctx.db, args.publicId);
  },
});

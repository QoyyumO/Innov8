import { DatabaseReader } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { DecisionOutcome, RecordType } from "../domain";

/**
 * Record exchange service (INN-40).
 *
 * Simulated federation: a request names one target facility, and only that
 * facility's clinical summary is read. Only the record types on the request
 * are copied into the response — `conditions` and unrequested fields never
 * leave this module.
 */

const EMERGENCY_GRANT_LOOKUP_LIMIT = 50;

export type AuthorisedSections = {
  medicalSummary?: string;
  allergies?: string[];
  medications?: string[];
  diagnoses?: string[];
};

export type ViewAuthorisation =
  | { isAuthorised: true; grantedBy: "decision" }
  | { isAuthorised: true; grantedBy: "emergency"; emergencyExpiresAt: number }
  | {
      isAuthorised: false;
      outcome: DecisionOutcome | null;
      riskScore: number | null;
      reasons: string[];
    };

async function findLiveEmergencyGrant(
  db: DatabaseReader,
  request: Doc<"accessRequests">,
  now: number,
): Promise<Doc<"emergencyAccess"> | null> {
  const grants = await db
    .query("emergencyAccess")
    .withIndex("by_actorId", (query) => query.eq("actorId", request.actorId))
    .order("desc")
    .take(EMERGENCY_GRANT_LOOKUP_LIMIT);
  return (
    grants.find(
      (grant) =>
        grant.requestId === request._id &&
        grant.revokedAt === undefined &&
        grant.expiresAt > now,
    ) ?? null
  );
}

/**
 * ALLOW decisions authorise a view. Otherwise a live (unexpired, unrevoked)
 * emergency grant on this same request does (INN-41). Anything else is
 * denied, with the decision's outcome and reasons for the UI.
 */
export async function resolveViewAuthorisation(
  db: DatabaseReader,
  request: Doc<"accessRequests">,
  now: number,
): Promise<ViewAuthorisation> {
  const decision = await db
    .query("accessDecisions")
    .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
    .unique();
  if (decision?.outcome === "ALLOW") {
    return { isAuthorised: true, grantedBy: "decision" };
  }

  const grant = await findLiveEmergencyGrant(db, request, now);
  if (grant) {
    return {
      isAuthorised: true,
      grantedBy: "emergency",
      emergencyExpiresAt: grant.expiresAt,
    };
  }

  return {
    isAuthorised: false,
    outcome: decision?.outcome ?? null,
    riskScore: decision?.riskScore ?? null,
    reasons: decision?.reasons ?? ["No decision has been recorded for this request"],
  };
}

export function pickAuthorisedSections(
  summary: Doc<"clinicalSummaries">,
  recordTypes: readonly RecordType[],
): AuthorisedSections {
  const sections: AuthorisedSections = {};
  for (const recordType of recordTypes) {
    if (recordType === "medical_summary") {
      sections.medicalSummary = summary.medicalSummary;
    } else if (recordType === "allergies") {
      sections.allergies = [...summary.allergies];
    } else if (recordType === "medications") {
      sections.medications = [...summary.medications];
    } else if (recordType === "diagnoses") {
      sections.diagnoses = [...summary.diagnoses];
    }
  }
  return sections;
}

export async function loadTargetSummary(
  db: DatabaseReader,
  patientId: Id<"patients">,
  targetFacilityId: Id<"facilities">,
): Promise<Doc<"clinicalSummaries"> | null> {
  return await db
    .query("clinicalSummaries")
    .withIndex("by_patientId_facilityId", (query) =>
      query.eq("patientId", patientId).eq("facilityId", targetFacilityId),
    )
    .first();
}

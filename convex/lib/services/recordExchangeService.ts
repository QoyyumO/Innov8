import { DatabaseReader } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import {
  ALLOW_EXPIRED_REASON,
  allowWindowStart,
  allowedUntil,
  isAllowExpired,
} from "../accessWindow";
import { DecisionOutcome, RecordType } from "../domain";
import { isLiveGrant, listGrantsForRequest } from "./emergencyAccessService";

/**
 * Record exchange service (INN-40).
 *
 * Simulated federation: a request names one target facility, and only that
 * facility's clinical summary is read. Only the record types on the request
 * are copied into the response — `conditions` and unrequested fields never
 * leave this module.
 */

export type AuthorisedSections = {
  medicalSummary?: string;
  allergies?: string[];
  medications?: string[];
  diagnoses?: string[];
  labResults?: string[];
};

export type ViewAuthorisation =
  | { isAuthorised: true; grantedBy: "decision"; allowedUntil: number }
  | { isAuthorised: true; grantedBy: "emergency"; emergencyExpiresAt: number }
  | {
      isAuthorised: false;
      outcome: DecisionOutcome | null;
      riskScore: number | null;
      reasons: string[];
      /** Set when an ALLOW decision has passed its validity window (INN-51). */
      expiredAt?: number;
    };

/**
 * When a request has any emergency grant (INN-41), the grant alone governs
 * it: authorised only while a grant is live, refused after expiry or
 * revocation. Otherwise an ALLOW decision authorises the view for
 * `ALLOW_VALIDITY_MS` after it was made (INN-51). Anything else is denied,
 * with the decision's outcome and reasons for the UI.
 */
export async function resolveViewAuthorisation(
  db: DatabaseReader,
  request: Doc<"accessRequests">,
  now: number,
): Promise<ViewAuthorisation> {
  const grants = await listGrantsForRequest(db, request._id);
  const decision = await db
    .query("accessDecisions")
    .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
    .unique();

  if (grants.length > 0) {
    const liveGrant = grants.find((grant) => isLiveGrant(grant, now));
    if (liveGrant) {
      return {
        isAuthorised: true,
        grantedBy: "emergency",
        emergencyExpiresAt: liveGrant.expiresAt,
      };
    }
    return {
      isAuthorised: false,
      outcome: decision?.outcome ?? null,
      riskScore: decision?.riskScore ?? null,
      reasons: ["Emergency access for this request has ended"],
    };
  }

  if (decision?.outcome === "ALLOW") {
    const windowStart = allowWindowStart(decision);
    if (isAllowExpired(windowStart, now)) {
      return {
        isAuthorised: false,
        outcome: decision.outcome,
        riskScore: decision.riskScore,
        reasons: [ALLOW_EXPIRED_REASON],
        expiredAt: allowedUntil(windowStart),
      };
    }
    return {
      isAuthorised: true,
      grantedBy: "decision",
      allowedUntil: allowedUntil(windowStart),
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
    } else if (recordType === "lab_results") {
      sections.labResults = [...(summary.labResults ?? [])];
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

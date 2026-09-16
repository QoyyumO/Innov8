import { DecisionOutcome, Purpose, RecordType } from "../domain";
import { HARVEST_RECORD_COUNT, HARVEST_SCORE } from "../riskConstants";
import { assertDecisionReasons, assertRiskScore } from "../invariants";
import { ADMIN_ROLES, CLINICIAN_ROLES, SECURITY_ROLES, UserRole } from "../roles";

/**
 * Risk scoring service (INN-38).
 *
 * Pure and explainable: no database reads or writes. The caller
 * (`createAccessRequest`, INN-37) loads the actor and patient, calls
 * `scoreAccessRequest`, and persists `accessDecisions` with the returned
 * `score`, `outcome`, `reasons`, and `factors`.
 *
 * Model: additive points clamped to 0–100, then the harvest rule.
 * Every evaluated factor adds a reason, so `reasons` is never empty.
 *
 * Demo invariants (see AGENTS.md):
 * - Ibrahim (doctor, FMC Abuja) → PAT-002391 (FMC Lagos), treatment,
 *   1 record = 5 base + 0 role + 0 purpose + 3 cross-facility = 8 → ALLOW.
 * - Any request covering >= 500 records → at least 94 → BLOCK.
 */

/** Scores below this are ALLOW. */
export const VERIFY_THRESHOLD = 40;
/** Scores at or above this are BLOCK; between the two is VERIFY. */
export const BLOCK_THRESHOLD = 80;

export const BASE_SCORE = 5;
export const CROSS_FACILITY_POINTS = 3;
export const WITHIN_BASELINE_POINTS = 5;
export const ABOVE_BASELINE_POINTS = 35;
export const AFTER_HOURS_POINTS = 15;

export { HARVEST_RECORD_COUNT, HARVEST_SCORE };

/** Used when a worker has no `normalPatientVolume` yet. */
export const DEFAULT_PATIENT_VOLUME = 20;

/** Facilities run on West Africa Time (UTC+1, no daylight saving). */
const FACILITY_UTC_OFFSET_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;

const ADMIN_ROLE_POINTS = 15;
const SECURITY_ROLE_POINTS = 25;
const NON_CLINICAL_ROLE_POINTS = 80;

const PURPOSE_POINTS: Record<Purpose, number> = {
  treatment: 0,
  emergency: 5,
  "follow-up": 5,
  referral: 8,
  administrative: 20,
};

/** Clinical care happens around the clock, so these skip the after-hours check. */
const ROUND_THE_CLOCK_PURPOSES: readonly Purpose[] = ["treatment", "emergency"];

export type AccessHours = { start: string; end: string };

export type RiskInput = {
  actorRoles: readonly UserRole[];
  purpose: Purpose;
  /**
   * Caller contract for INN-37: at least one type is required so an empty
   * request cannot be scored. Types are not weighted; more types do not
   * raise the score.
   */
  recordTypes: readonly RecordType[];
  /** Number of patient records the request covers (1 for a normal lookup). */
  recordCount: number;
  /** True when the records are held at the requester's own facility. */
  sameHospital: boolean;
  requestedAt: number;
  normalAccessHours?: AccessHours;
  normalPatientVolume?: number;
};

export type RiskFactors = {
  role: UserRole;
  purpose: Purpose;
  sameHospital: boolean;
  recordCount: number;
};

/** Domain value object (`Innov8_DDD.md` RiskBreakdown). */
export type RiskBreakdown = {
  score: number;
  outcome: DecisionOutcome;
  reasons: string[];
  /** Snapshot for `accessDecisions.factors`. */
  factors: RiskFactors;
};

/** Alias of RiskBreakdown for callers that used the earlier name. */
export type RiskResult = RiskBreakdown;

export function outcomeForScore(score: number): DecisionOutcome {
  if (score >= BLOCK_THRESHOLD) {
    return "BLOCK";
  }
  if (score >= VERIFY_THRESHOLD) {
    return "VERIFY";
  }
  return "ALLOW";
}

function formatRole(role: UserRole): string {
  return role.replace(/_/g, " ");
}

function primaryRole(roles: readonly UserRole[]): UserRole {
  const clinicalRole = roles.find((role) => CLINICIAN_ROLES.includes(role));
  const fallbackRole = roles[0];
  if (clinicalRole) {
    return clinicalRole;
  }
  if (fallbackRole) {
    return fallbackRole;
  }
  throw new Error("Risk scoring requires at least one role");
}

function scoreRole(role: UserRole): { points: number; reason: string } {
  if (CLINICIAN_ROLES.includes(role)) {
    return { points: 0, reason: `Clinical role (${formatRole(role)})` };
  }
  if (ADMIN_ROLES.includes(role)) {
    return {
      points: ADMIN_ROLE_POINTS,
      reason: "Administrative role requesting clinical records",
    };
  }
  if (SECURITY_ROLES.includes(role)) {
    return {
      points: SECURITY_ROLE_POINTS,
      reason: "Security role requesting clinical records",
    };
  }
  return {
    points: NON_CLINICAL_ROLE_POINTS,
    reason: "Role is not permitted to request clinical records",
  };
}

function describePurpose(purpose: Purpose): string {
  if (purpose === "administrative") {
    return "Administrative purpose needs extra scrutiny";
  }
  const label = purpose === "follow-up" ? "Follow-up" : purpose[0].toUpperCase() + purpose.slice(1);
  return `${label} purpose`;
}

function scoreVolume(
  recordCount: number,
  baseline: number,
): { points: number; reason: string } {
  if (recordCount === 1) {
    return { points: 0, reason: "Single patient record" };
  }
  if (recordCount <= baseline) {
    return {
      points: WITHIN_BASELINE_POINTS,
      reason: `${recordCount} records, within normal volume (${baseline})`,
    };
  }
  return {
    points: ABOVE_BASELINE_POINTS,
    reason: `${recordCount} records, far above normal volume (${baseline})`,
  };
}

function parseClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * True when `requestedAt` falls outside the window (facility local time).
 * Supports overnight windows such as 20:00–06:00. Returns false when the
 * window is missing or malformed, so bad baseline data never raises risk.
 */
export function isOutsideAccessHours(
  requestedAt: number,
  accessHours: AccessHours | undefined,
): boolean {
  if (!accessHours) {
    return false;
  }
  const startMinutes = parseClockMinutes(accessHours.start);
  const endMinutes = parseClockMinutes(accessHours.end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  const utcMinutes = Math.floor(requestedAt / 60_000);
  const localMinutes =
    (((utcMinutes + FACILITY_UTC_OFFSET_MINUTES) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;

  const isInside =
    startMinutes < endMinutes
      ? localMinutes >= startMinutes && localMinutes < endMinutes
      : localMinutes >= startMinutes || localMinutes < endMinutes;
  return !isInside;
}

export function scoreAccessRequest(input: RiskInput): RiskBreakdown {
  if (input.recordTypes.length === 0) {
    throw new Error("Risk scoring requires at least one record type");
  }
  if (!Number.isInteger(input.recordCount) || input.recordCount < 1) {
    throw new Error("recordCount must be a whole number of at least 1");
  }

  const role = primaryRole(input.actorRoles);
  const baseline = input.normalPatientVolume ?? DEFAULT_PATIENT_VOLUME;
  const reasons: string[] = [];
  let score = BASE_SCORE;

  const roleScore = scoreRole(role);
  score += roleScore.points;
  reasons.push(roleScore.reason);

  score += PURPOSE_POINTS[input.purpose];
  reasons.push(describePurpose(input.purpose));

  if (input.sameHospital) {
    reasons.push("Records are held at the requester's facility");
  } else {
    score += CROSS_FACILITY_POINTS;
    reasons.push("Records are held at another facility");
  }

  const volumeScore = scoreVolume(input.recordCount, baseline);
  score += volumeScore.points;
  reasons.push(volumeScore.reason);

  if (
    !ROUND_THE_CLOCK_PURPOSES.includes(input.purpose) &&
    isOutsideAccessHours(input.requestedAt, input.normalAccessHours)
  ) {
    score += AFTER_HOURS_POINTS;
    reasons.push("Outside the requester's normal access hours");
  }

  score = Math.min(100, Math.max(0, score));

  if (input.recordCount >= HARVEST_RECORD_COUNT) {
    score = Math.max(score, HARVEST_SCORE);
    reasons.push(
      `Harvest pattern: one request covers ${input.recordCount} patient records`,
    );
  }

  const finalScore = assertRiskScore(score);
  return {
    score: finalScore,
    outcome: outcomeForScore(finalScore),
    reasons: assertDecisionReasons(reasons),
    factors: {
      role,
      purpose: input.purpose,
      sameHospital: input.sameHospital,
      recordCount: input.recordCount,
    },
  };
}

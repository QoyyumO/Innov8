import { DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { AlertStatus } from "../domain";
import { appendAuditEvent } from "./auditLogService";
import {
  linkAlertFacilities,
  resolveReviewerScope,
  scopeIncludesAlert,
  updateAlertFacilitiesStatus,
} from "../facilityScope";
import { throwAppError } from "../appError";
import { HARVEST_RECORD_COUNT } from "../riskConstants";

/**
 * Alert service (INN-39).
 *
 * Every BLOCK decision raises a high-severity security alert in the same
 * transaction and audits `SecurityAlertRaised`. Alert text names who asked
 * for what and why it was blocked — never clinical content.
 */

export const ALERT_NOT_FOUND_CODE = "ALERT_NOT_FOUND";
export const ALERT_NOT_FOUND_MESSAGE = "Alert not found";
export const ALERT_INVALID_STATUS_CODE = "ALERT_INVALID_STATUS";

export const HARVEST_ALERT_TITLE = "Bulk record harvest blocked";
export const BLOCK_ALERT_TITLE = "High-risk access request blocked";
export const EMERGENCY_ALERT_TITLE = "Break-glass access granted";

export type BlockAlertInput = {
  decisionId: Id<"accessDecisions">;
  /** The blocked request; its source/target scope the alert (INN-52). */
  requestId: Id<"accessRequests">;
  actor: Doc<"users">;
  sessionId?: Id<"sessions">;
  patientPublicId: string;
  recordCount: number;
  riskScore: number;
  reasons: string[];
  createdAt: number;
};

async function linkRequestFacilities(
  db: DatabaseWriter,
  alertId: Id<"securityAlerts">,
  requestId: Id<"accessRequests">,
  createdAt: number,
): Promise<void> {
  const request = await db.get(requestId);
  if (request) {
    await linkAlertFacilities(db, { alertId, status: "open", createdAt }, request);
  }
}

export function isHarvestCount(recordCount: number): boolean {
  return recordCount >= HARVEST_RECORD_COUNT;
}

function describeActor(actor: Doc<"users">): string {
  const name = `${actor.profile.firstName} ${actor.profile.lastName}`.trim();
  return `${name} (${actor.hospital})`;
}

export async function raiseBlockAlert(
  db: DatabaseWriter,
  input: BlockAlertInput,
): Promise<Id<"securityAlerts">> {
  const recordLabel =
    input.recordCount === 1 ? "1 patient record" : `${input.recordCount} patient records`;
  const alertId = await db.insert("securityAlerts", {
    decisionId: input.decisionId,
    severity: "high",
    status: "open",
    title: isHarvestCount(input.recordCount) ? HARVEST_ALERT_TITLE : BLOCK_ALERT_TITLE,
    message: `${describeActor(input.actor)} requested ${recordLabel} (${input.patientPublicId}). Risk ${input.riskScore}/100. ${input.reasons.join(". ")}.`,
    createdAt: input.createdAt,
  });
  await linkRequestFacilities(db, alertId, input.requestId, input.createdAt);

  await appendAuditEvent(db, {
    actorId: input.actor._id,
    sessionId: input.sessionId,
    action: "SecurityAlertRaised",
    entity: "securityAlerts",
    entityId: alertId,
    details: {
      decisionId: input.decisionId,
      severity: "high",
      patientPublicId: input.patientPublicId,
      recordCount: input.recordCount,
      riskScore: input.riskScore,
    },
    createdAt: input.createdAt,
  });

  return alertId;
}

export type EmergencyAlertInput = {
  emergencyAccessId: Id<"emergencyAccess">;
  requestId: Id<"accessRequests">;
  actor: Doc<"users">;
  sessionId?: Id<"sessions">;
  patientPublicId: string;
  justification: string;
  expiresAt: number;
  createdAt: number;
};

/** INN-41: every break-glass grant is reported to security for review. */
export async function raiseEmergencyAlert(
  db: DatabaseWriter,
  input: EmergencyAlertInput,
): Promise<Id<"securityAlerts">> {
  const minutes = Math.round((input.expiresAt - input.createdAt) / 60_000);
  const alertId = await db.insert("securityAlerts", {
    emergencyAccessId: input.emergencyAccessId,
    severity: "medium",
    status: "open",
    title: EMERGENCY_ALERT_TITLE,
    message: `${describeActor(input.actor)} used break-glass for ${input.patientPublicId} (${minutes} minutes). Justification: "${input.justification}"`,
    createdAt: input.createdAt,
  });
  await linkRequestFacilities(db, alertId, input.requestId, input.createdAt);

  await appendAuditEvent(db, {
    actorId: input.actor._id,
    sessionId: input.sessionId,
    action: "SecurityAlertRaised",
    entity: "securityAlerts",
    entityId: alertId,
    details: {
      emergencyAccessId: input.emergencyAccessId,
      severity: "medium",
      patientPublicId: input.patientPublicId,
    },
    createdAt: input.createdAt,
  });

  return alertId;
}

/** Allowed status moves. Rows are never deleted. */
const ALLOWED_TRANSITIONS: Record<AlertStatus, readonly AlertStatus[]> = {
  open: ["acknowledged", "closed"],
  acknowledged: ["closed"],
  closed: [],
};

const TRANSITION_AUDIT_ACTIONS = {
  acknowledged: "SecurityAlertAcknowledged",
  closed: "SecurityAlertClosed",
} as const;

export type AlertReviewer = {
  user: Doc<"users">;
  session: Doc<"sessions">;
};

/**
 * Moves an alert forward (open → acknowledged → closed, or open → closed)
 * and audits who did it (INN-50). Hospital admins may only move alerts that
 * involve their facility; others look "not found" (INN-52). Invalid
 * transitions throw, so nothing is written for them.
 */
export async function transitionAlert(
  db: DatabaseWriter,
  { user, session }: AlertReviewer,
  alertId: Id<"securityAlerts">,
  nextStatus: Exclude<AlertStatus, "open">,
  now: number,
): Promise<Doc<"securityAlerts">> {
  const alert = await db.get(alertId);
  const scope = await resolveReviewerScope(db, user);
  if (!alert || !(await scopeIncludesAlert(db, scope, alertId))) {
    throwAppError(ALERT_NOT_FOUND_CODE, ALERT_NOT_FOUND_MESSAGE);
  }
  if (!ALLOWED_TRANSITIONS[alert.status].includes(nextStatus)) {
    throwAppError(ALERT_INVALID_STATUS_CODE, `Alert is already ${alert.status}`);
  }
  await db.patch(alertId, { status: nextStatus });
  await updateAlertFacilitiesStatus(db, alertId, nextStatus);
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: TRANSITION_AUDIT_ACTIONS[nextStatus],
    entity: "securityAlerts",
    entityId: alertId,
    details: {
      fromStatus: alert.status,
      toStatus: nextStatus,
      severity: alert.severity,
    },
    createdAt: now,
  });
  return { ...alert, status: nextStatus };
}

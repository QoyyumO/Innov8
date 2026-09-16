import { DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { AlertStatus } from "../domain";
import { appendAuditEvent } from "./auditLogService";
import { HARVEST_RECORD_COUNT } from "../riskConstants";

/**
 * Alert service (INN-39).
 *
 * Every BLOCK decision raises a high-severity security alert in the same
 * transaction and audits `SecurityAlertRaised`. Alert text names who asked
 * for what and why it was blocked — never clinical content.
 */

export const ALERT_NOT_FOUND_MESSAGE = "Alert not found";

export const HARVEST_ALERT_TITLE = "Bulk record harvest blocked";
export const BLOCK_ALERT_TITLE = "High-risk access request blocked";

export type BlockAlertInput = {
  decisionId: Id<"accessDecisions">;
  actor: Doc<"users">;
  sessionId?: Id<"sessions">;
  patientPublicId: string;
  recordCount: number;
  riskScore: number;
  reasons: string[];
  createdAt: number;
};

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

/** Allowed status moves. Rows are never deleted. */
const ALLOWED_TRANSITIONS: Record<AlertStatus, readonly AlertStatus[]> = {
  open: ["acknowledged", "closed"],
  acknowledged: ["closed"],
  closed: [],
};

export async function transitionAlert(
  db: DatabaseWriter,
  alertId: Id<"securityAlerts">,
  nextStatus: AlertStatus,
): Promise<Doc<"securityAlerts">> {
  const alert = await db.get(alertId);
  if (!alert) {
    throw new Error(ALERT_NOT_FOUND_MESSAGE);
  }
  if (!ALLOWED_TRANSITIONS[alert.status].includes(nextStatus)) {
    throw new Error(`Alert is already ${alert.status}`);
  }
  await db.patch(alertId, { status: nextStatus });
  return { ...alert, status: nextStatus };
}

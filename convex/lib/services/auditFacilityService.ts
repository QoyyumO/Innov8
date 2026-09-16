import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import {
  listAlertFacilityIds,
  requestFacilityIds,
  resolveUserFacilityId,
} from "../facilityScope";

/**
 * Facility index for audit events (INN-52). Kept apart from
 * `auditLogService` so that module still exposes only `appendAuditEvent`.
 * Nothing here updates or deletes `auditEvents`.
 */

export type AuditEventRow = Pick<
  Doc<"auditEvents">,
  "_id" | "actorId" | "action" | "entity" | "entityId" | "details" | "createdAt"
>;

/** The access request an audit event is about, if it names one. */
async function findEventRequest(
  db: DatabaseReader,
  event: AuditEventRow,
): Promise<Doc<"accessRequests"> | null> {
  const detailsRequestId =
    typeof event.details.requestId === "string"
      ? db.normalizeId("accessRequests", event.details.requestId)
      : null;
  if (detailsRequestId) {
    return await db.get(detailsRequestId);
  }
  if (!event.entityId) {
    return null;
  }
  if (event.entity === "accessRequests") {
    const requestId = db.normalizeId("accessRequests", event.entityId);
    return requestId ? await db.get(requestId) : null;
  }
  const decisionId = db.normalizeId("accessDecisions", event.entityId);
  if (decisionId) {
    const decision = await db.get(decisionId);
    return decision ? await db.get(decision.requestId) : null;
  }
  const grantId = db.normalizeId("emergencyAccess", event.entityId);
  if (grantId) {
    const grant = await db.get(grantId);
    return grant ? await db.get(grant.requestId) : null;
  }
  return null;
}

/** Facilities an audit event involves: the actor's, plus its request's source/target, its alert's, or its consent's. */
export async function resolveEventFacilityIds(
  db: DatabaseReader,
  event: AuditEventRow,
): Promise<Id<"facilities">[]> {
  const facilityIds = new Set<Id<"facilities">>();
  const actor = event.actorId ? await db.get(event.actorId) : null;
  const actorFacilityId = actor ? await resolveUserFacilityId(db, actor) : null;
  if (actorFacilityId) {
    facilityIds.add(actorFacilityId);
  }

  const request = await findEventRequest(db, event);
  for (const facilityId of request ? requestFacilityIds(request) : []) {
    facilityIds.add(facilityId);
  }

  const consentId =
    event.entity === "consents" && event.entityId
      ? db.normalizeId("consents", event.entityId)
      : null;
  const consent = consentId ? await db.get(consentId) : null;
  if (consent) {
    facilityIds.add(consent.facilityId);
    facilityIds.add(consent.patientFacilityId);
  }

  const alertId =
    event.entity === "securityAlerts" && event.entityId
      ? db.normalizeId("securityAlerts", event.entityId)
      : null;
  for (const facilityId of alertId ? await listAlertFacilityIds(db, alertId) : []) {
    facilityIds.add(facilityId);
  }
  return [...facilityIds];
}

export async function linkAuditEventFacilities(
  db: DatabaseWriter,
  event: AuditEventRow,
): Promise<void> {
  for (const facilityId of await resolveEventFacilityIds(db, event)) {
    await db.insert("auditEventFacilities", {
      eventId: event._id,
      facilityId,
      actorId: event.actorId,
      action: event.action,
      createdAt: event.createdAt,
    });
  }
}

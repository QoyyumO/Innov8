import { DatabaseWriter } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { AuditAction, AuditDetails } from "../domain";
import { assertNonEmptyString } from "../invariants";

export type AuditEventInput = {
  actorId?: Id<"users">;
  sessionId?: Id<"sessions">;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details: AuditDetails;
  /** Defaults to now. Override only for seeded/backdated history. */
  createdAt?: number;
};

/**
 * Append-only audit log (INN-35).
 *
 * This module intentionally exports no update or delete helpers, and no
 * public Convex function writes to `auditEvents` directly. `action` must be
 * one of the closed `auditAction` literals in `convex/lib/domain.ts`; the
 * schema re-validates it on insert.
 */
export async function appendAuditEvent(
  db: DatabaseWriter,
  event: AuditEventInput,
): Promise<Id<"auditEvents">> {
  return await db.insert("auditEvents", {
    actorId: event.actorId,
    sessionId: event.sessionId,
    action: event.action,
    entity: assertNonEmptyString("entity", event.entity),
    entityId: event.entityId,
    details: event.details,
    createdAt: event.createdAt ?? Date.now(),
  });
}

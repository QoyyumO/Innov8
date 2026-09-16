import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { AlertStatus } from "./domain";
import { getReviewScope } from "./roles";

/**
 * Facility scope for hospital admins (INN-52).
 *
 * A hospital admin reviews activity that involves their facility: their own
 * staff's actions, and any request (with its decision, alert, or break-glass
 * grant) whose source or target is their facility. Security officers and
 * system admins review everything.
 */

/**
 * The user's facility: `users.facilityId`, or the facility whose name matches
 * `users.hospital` (demo logins created before the seed linked them), or null.
 */
export async function resolveUserFacilityId(
  db: DatabaseReader,
  user: Doc<"users">,
): Promise<Id<"facilities"> | null> {
  if (user.facilityId) {
    return user.facilityId;
  }
  const facility = await db
    .query("facilities")
    .withIndex("by_name", (query) => query.eq("name", user.hospital))
    .first();
  return facility?._id ?? null;
}

export type ReviewerScope =
  | { kind: "global" }
  | { kind: "facility"; facilityId: Id<"facilities"> | null }
  | { kind: "none" };

export async function resolveReviewerScope(
  db: DatabaseReader,
  user: Doc<"users">,
): Promise<ReviewerScope> {
  const scope = getReviewScope(user);
  if (scope === "facility") {
    return { kind: "facility", facilityId: await resolveUserFacilityId(db, user) };
  }
  return { kind: scope };
}

export function requestFacilityIds(request: Doc<"accessRequests">): Id<"facilities">[] {
  return request.sourceFacilityId === request.targetFacilityId
    ? [request.sourceFacilityId]
    : [request.sourceFacilityId, request.targetFacilityId];
}

/** Whether a global or facility reviewer may see this request. */
export function scopeIncludesRequest(
  scope: ReviewerScope,
  request: Doc<"accessRequests">,
): boolean {
  if (scope.kind === "global") {
    return true;
  }
  return (
    scope.kind === "facility" &&
    scope.facilityId !== null &&
    requestFacilityIds(request).includes(scope.facilityId)
  );
}

export async function listAlertFacilityIds(
  db: DatabaseReader,
  alertId: Id<"securityAlerts">,
): Promise<Id<"facilities">[]> {
  const rows = await db
    .query("alertFacilities")
    .withIndex("by_alertId", (query) => query.eq("alertId", alertId))
    .take(10);
  return rows.map((row) => row.facilityId);
}

/** Whether a global or facility reviewer may see this alert. */
export async function scopeIncludesAlert(
  db: DatabaseReader,
  scope: ReviewerScope,
  alertId: Id<"securityAlerts">,
): Promise<boolean> {
  if (scope.kind === "global") {
    return true;
  }
  if (scope.kind !== "facility" || scope.facilityId === null) {
    return false;
  }
  return (await listAlertFacilityIds(db, alertId)).includes(scope.facilityId);
}

export async function linkAlertFacilities(
  db: DatabaseWriter,
  alert: { alertId: Id<"securityAlerts">; status: AlertStatus; createdAt: number },
  request: Doc<"accessRequests">,
): Promise<void> {
  for (const facilityId of requestFacilityIds(request)) {
    await db.insert("alertFacilities", {
      alertId: alert.alertId,
      facilityId,
      status: alert.status,
      createdAt: alert.createdAt,
    });
  }
}

export async function updateAlertFacilitiesStatus(
  db: DatabaseWriter,
  alertId: Id<"securityAlerts">,
  status: AlertStatus,
): Promise<void> {
  const rows = await db
    .query("alertFacilities")
    .withIndex("by_alertId", (query) => query.eq("alertId", alertId))
    .take(10);
  for (const row of rows) {
    await db.patch(row._id, { status });
  }
}

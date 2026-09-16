import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Stored per-facility totals (INN-53).
 *
 * `workerCount` counts users linked to the facility (`users.facilityId`) who
 * hold at least one non-patient role; `patientCount` counts patients whose
 * home facility it is. Every insert or facility change for users and
 * patients goes through the helpers below so the totals stay exact without
 * counting rows on read. `recountFacilityStats` (see
 * `convex/facilityStatsRecount.ts`) rebuilds them from scratch.
 */

export type FacilityStatField = "workerCount" | "patientCount";

export type FacilityTotals = { workerCount: number; patientCount: number };

type WorkerShape = Pick<Doc<"users">, "roles" | "facilityId">;

/** A healthcare worker, as counted per facility: any non-patient role. */
export function isFacilityWorker(user: Pick<Doc<"users">, "roles">): boolean {
  return user.roles.some((role) => role !== "patient");
}

function workerFacilityId(user: WorkerShape): Id<"facilities"> | undefined {
  return isFacilityWorker(user) ? user.facilityId : undefined;
}

export async function getFacilityTotals(
  db: DatabaseReader,
  facilityId: Id<"facilities">,
): Promise<FacilityTotals> {
  const stats = await db
    .query("facilityStats")
    .withIndex("by_facilityId", (query) => query.eq("facilityId", facilityId))
    .unique();
  return {
    workerCount: stats?.workerCount ?? 0,
    patientCount: stats?.patientCount ?? 0,
  };
}

export async function setFacilityTotals(
  db: DatabaseWriter,
  facilityId: Id<"facilities">,
  totals: Partial<FacilityTotals>,
  now: number,
): Promise<void> {
  const stats = await db
    .query("facilityStats")
    .withIndex("by_facilityId", (query) => query.eq("facilityId", facilityId))
    .unique();
  if (stats) {
    await db.patch(stats._id, { ...totals, updatedAt: now });
    return;
  }
  await db.insert("facilityStats", {
    facilityId,
    workerCount: totals.workerCount ?? 0,
    patientCount: totals.patientCount ?? 0,
    updatedAt: now,
  });
}

async function adjustFacilityStat(
  db: DatabaseWriter,
  facilityId: Id<"facilities"> | undefined,
  field: FacilityStatField,
  delta: number,
): Promise<void> {
  if (!facilityId || delta === 0) {
    return;
  }
  const current = await getFacilityTotals(db, facilityId);
  await setFacilityTotals(
    db,
    facilityId,
    { [field]: Math.max(0, current[field] + delta) },
    Date.now(),
  );
}

async function moveFacilityStat(
  db: DatabaseWriter,
  field: FacilityStatField,
  fromFacilityId: Id<"facilities"> | undefined,
  toFacilityId: Id<"facilities"> | undefined,
): Promise<void> {
  if (fromFacilityId === toFacilityId) {
    return;
  }
  await adjustFacilityStat(db, fromFacilityId, field, -1);
  await adjustFacilityStat(db, toFacilityId, field, 1);
}

/** Insert a user and count them if they are a linked worker. */
export async function insertCountedUser(
  db: DatabaseWriter,
  user: Omit<Doc<"users">, "_id" | "_creationTime">,
): Promise<Id<"users">> {
  const userId = await db.insert("users", user);
  await adjustFacilityStat(db, workerFacilityId(user), "workerCount", 1);
  return userId;
}

/** Patch a user and move their worker count if their facility or roles change. */
export async function patchCountedUser(
  db: DatabaseWriter,
  existing: Doc<"users">,
  fields: Partial<Omit<Doc<"users">, "_id" | "_creationTime">>,
): Promise<void> {
  await db.patch(existing._id, fields);
  await moveFacilityStat(
    db,
    "workerCount",
    workerFacilityId(existing),
    workerFacilityId({ ...existing, ...fields }),
  );
}

/** Insert a patient and count them at their home facility. */
export async function insertCountedPatient(
  db: DatabaseWriter,
  patient: Omit<Doc<"patients">, "_id" | "_creationTime">,
): Promise<Id<"patients">> {
  const patientId = await db.insert("patients", patient);
  await adjustFacilityStat(db, patient.homeFacilityId, "patientCount", 1);
  return patientId;
}

/** Patch a patient and move their count if their home facility changes. */
export async function patchCountedPatient(
  db: DatabaseWriter,
  existing: Doc<"patients">,
  fields: Partial<Omit<Doc<"patients">, "_id" | "_creationTime">>,
): Promise<void> {
  await db.patch(existing._id, fields);
  await moveFacilityStat(
    db,
    "patientCount",
    existing.homeFacilityId,
    fields.homeFacilityId ?? existing.homeFacilityId,
  );
}

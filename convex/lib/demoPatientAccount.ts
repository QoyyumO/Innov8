import { DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { demoPatientUsers, DemoPatientUserSeed } from "./demoUsers";
import { patchCountedUser } from "./facilityStats";

function isPatientOnly(user: Pick<Doc<"users">, "roles">): boolean {
  return user.roles.length === 1 && user.roles[0] === "patient";
}

function hasWorkerResidue(user: Doc<"users">): boolean {
  return (
    user.department !== undefined ||
    user.workerId !== undefined ||
    user.normalAccessHours !== undefined ||
    user.normalPatientVolume !== undefined
  );
}

function patientLoginDocument(
  existing: Doc<"users">,
  demoUser: DemoPatientUserSeed,
  patientId: Id<"patients"> | undefined,
): Omit<Doc<"users">, "_id" | "_creationTime"> {
  return {
    email: existing.email,
    hashedPassword: existing.hashedPassword,
    roles: ["patient"],
    hospital: demoUser.hospital,
    accountStatus: existing.accountStatus,
    profile: demoUser.profile,
    ...(existing.facilityId !== undefined ? { facilityId: existing.facilityId } : {}),
    ...(patientId !== undefined ? { patientId } : {}),
    ...(existing.sessionsInvalidatedAt !== undefined
      ? { sessionsInvalidatedAt: existing.sessionsInvalidatedAt }
      : {}),
  };
}

/**
 * Chioma is a patient login, not a clinician. Restores patient-only roles,
 * drops leftover worker fields (department, workerId, baselines), and links
 * `users.patientId` to PAT-002391 when that row exists.
 */
export async function syncDemoPatientLogins(db: DatabaseWriter): Promise<void> {
  for (const demoUser of demoPatientUsers()) {
    const existing = await db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", demoUser.email))
      .unique();
    if (!existing) {
      continue;
    }

    const patient = await db
      .query("patients")
      .withIndex("by_publicId", (query) => query.eq("publicId", demoUser.publicId))
      .unique();
    const patientId = patient?._id;
    const needsRoleFix = !isPatientOnly(existing);
    const needsLink = patientId !== undefined && existing.patientId !== patientId;
    if (!needsRoleFix && !hasWorkerResidue(existing) && !needsLink) {
      continue;
    }

    if (needsRoleFix) {
      await patchCountedUser(db, existing, { roles: ["patient"] });
    }
    const latest = (await db.get(existing._id)) ?? existing;
    await db.replace(
      existing._id,
      patientLoginDocument(latest, demoUser, patientId ?? latest.patientId),
    );
  }
}

import { DatabaseWriter } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { DEMO_USERS } from "./demoUsers";
import { patchCountedUser } from "./facilityStats";

function isPatientOnly(user: Pick<Doc<"users">, "roles">): boolean {
  return user.roles.length === 1 && user.roles[0] === "patient";
}

/**
 * Chioma is a patient login, not a clinician. If someone created her in the
 * dashboard as a doctor (or mixed roles), the clinician dashboard wins and
 * PAT-002391 history never shows.
 */
export async function repairDemoPatientRoles(db: DatabaseWriter): Promise<void> {
  for (const demoUser of DEMO_USERS) {
    if (demoUser.publicId === undefined) {
      continue;
    }
    const existing = await db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", demoUser.email))
      .unique();
    if (!existing || isPatientOnly(existing)) {
      continue;
    }
    await patchCountedUser(db, existing, { roles: ["patient"] });
  }
}

/** Attach each demo patient login to the `patients` row for its publicId. */
export async function linkDemoPatientLogins(db: DatabaseWriter): Promise<void> {
  for (const demoUser of DEMO_USERS) {
    const publicId = demoUser.publicId;
    if (publicId === undefined) {
      continue;
    }
    const [account, patient] = await Promise.all([
      db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", demoUser.email))
        .unique(),
      db
        .query("patients")
        .withIndex("by_publicId", (query) => query.eq("publicId", publicId))
        .unique(),
    ]);
    if (!account || !patient || account.patientId === patient._id) {
      continue;
    }
    await patchCountedUser(db, account, { patientId: patient._id });
  }
}

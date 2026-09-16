import { DatabaseReader } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import {
  NO_INDEXED_RECORDS_MESSAGE,
  NO_RECORD_TYPES_MESSAGE,
  NO_SOURCE_FACILITY_MESSAGE,
  PATIENT_NOT_FOUND_MESSAGE,
  RECORDS_NOT_HELD_PREFIX,
} from "../accessRequestMessages";
import { RecordType } from "../domain";

/**
 * Access control service (INN-37).
 *
 * Resolves who is asking for what: the patient, the requester's facility,
 * and the facility that holds the records. Session and role checks
 * (`requireSession`, `requireRole`) run before this in every caller.
 * Never reads `clinicalSummaries`.
 */

const RECORD_INDEX_LOOKUP_LIMIT = 20;

/** Sentence-case labels for server error text. UI title-case is in accessLabels.ts. */
export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  medical_summary: "medical summary",
  allergies: "allergies",
  medications: "medications",
  diagnoses: "diagnoses",
};

export type FacilitySummary = {
  _id: Id<"facilities">;
  code: string;
  name: string;
};

export type AccessTarget = {
  patient: Doc<"patients">;
  sourceFacilityId: Id<"facilities">;
  targetFacility: FacilitySummary;
  sameHospital: boolean;
};

export function normalizePublicId(publicId: string): string {
  return publicId.trim().toUpperCase();
}

/** De-duplicates while keeping the caller's order. Throws when empty. */
export function normalizeRecordTypes(recordTypes: RecordType[]): RecordType[] {
  const uniqueTypes = [...new Set(recordTypes)];
  if (uniqueTypes.length === 0) {
    throw new Error(NO_RECORD_TYPES_MESSAGE);
  }
  return uniqueTypes;
}

async function resolveSourceFacilityId(
  db: DatabaseReader,
  user: Doc<"users">,
): Promise<Id<"facilities">> {
  if (user.facilityId) {
    return user.facilityId;
  }
  // Demo logins exist before the seed links them to a facility.
  const facilityByName = await db
    .query("facilities")
    .withIndex("by_name", (query) => query.eq("name", user.hospital))
    .first();
  if (!facilityByName) {
    throw new Error(NO_SOURCE_FACILITY_MESSAGE);
  }
  return facilityByName._id;
}

async function resolveTargetIndex(
  db: DatabaseReader,
  patient: Doc<"patients">,
): Promise<Doc<"recordIndexes">> {
  const homeIndex = await db
    .query("recordIndexes")
    .withIndex("by_patientId_facilityId", (query) =>
      query
        .eq("patientId", patient._id)
        .eq("facilityId", patient.homeFacilityId),
    )
    .first();
  if (homeIndex) {
    return homeIndex;
  }

  const [firstIndex] = await db
    .query("recordIndexes")
    .withIndex("by_patientId", (query) => query.eq("patientId", patient._id))
    .take(RECORD_INDEX_LOOKUP_LIMIT);
  if (!firstIndex) {
    throw new Error(NO_INDEXED_RECORDS_MESSAGE);
  }
  return firstIndex;
}

export async function resolveAccessTarget(
  db: DatabaseReader,
  user: Doc<"users">,
  publicId: string,
  recordTypes: RecordType[],
): Promise<AccessTarget> {
  const patient = await db
    .query("patients")
    .withIndex("by_publicId", (query) =>
      query.eq("publicId", normalizePublicId(publicId)),
    )
    .unique();
  if (!patient) {
    throw new Error(PATIENT_NOT_FOUND_MESSAGE);
  }

  const sourceFacilityId = await resolveSourceFacilityId(db, user);
  const targetIndex = await resolveTargetIndex(db, patient);
  const targetFacilityDoc = await db.get(targetIndex.facilityId);
  if (!targetFacilityDoc) {
    throw new Error(NO_INDEXED_RECORDS_MESSAGE);
  }

  const missingTypes = recordTypes.filter(
    (recordType) => !targetIndex.recordTypes.includes(recordType),
  );
  if (missingTypes.length > 0) {
    throw new Error(
      `${RECORDS_NOT_HELD_PREFIX}${targetFacilityDoc.name}: ${missingTypes
        .map((recordType) => RECORD_TYPE_LABELS[recordType])
        .join(", ")}`,
    );
  }

  return {
    patient,
    sourceFacilityId,
    targetFacility: {
      _id: targetFacilityDoc._id,
      code: targetFacilityDoc.code,
      name: targetFacilityDoc.name,
    },
    sameHospital: sourceFacilityId === targetFacilityDoc._id,
  };
}

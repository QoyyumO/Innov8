import { RecordType } from "./domain";

/**
 * Which clinical sections a clinician role may request (INN-79).
 * Safe to import from the Next.js client.
 *
 * Doctors and nurses get the Track C four types plus lab results (INN-80).
 * Pharmacists get medications and allergies. Laboratory staff get diagnoses
 * and lab results. Do not invent a full EMR.
 */

const ALL_RECORD_TYPES: readonly RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
  "lab_results",
];

const PHARMACIST_RECORD_TYPES: readonly RecordType[] = ["allergies", "medications"];
const LABORATORY_RECORD_TYPES: readonly RecordType[] = ["diagnoses", "lab_results"];

export function allowedRecordTypesForRoles(
  roles: readonly string[],
): RecordType[] {
  if (roles.includes("doctor") || roles.includes("nurse")) {
    return [...ALL_RECORD_TYPES];
  }
  const allowed: RecordType[] = [];
  if (roles.includes("pharmacist")) {
    allowed.push(...PHARMACIST_RECORD_TYPES);
  }
  if (roles.includes("laboratory")) {
    allowed.push(...LABORATORY_RECORD_TYPES);
  }
  return ALL_RECORD_TYPES.filter((recordType) => allowed.includes(recordType));
}

export function isRecordTypeAllowedForRoles(
  roles: readonly string[],
  recordType: RecordType,
): boolean {
  return allowedRecordTypesForRoles(roles).includes(recordType);
}

/** Keep the caller's unchecked list unique when a checkbox flips. */
export function nextUncheckedRecordTypes(
  uncheckedRecordTypes: readonly RecordType[],
  recordType: RecordType,
  isChecked: boolean,
): RecordType[] {
  if (isChecked) {
    return uncheckedRecordTypes.filter((candidate) => candidate !== recordType);
  }
  if (uncheckedRecordTypes.includes(recordType)) {
    return [...uncheckedRecordTypes];
  }
  return [...uncheckedRecordTypes, recordType];
}

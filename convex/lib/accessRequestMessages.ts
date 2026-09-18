/**
 * Input-validation messages for access requests (INN-37).
 * Shared by the backend and the request form so wording cannot drift.
 * Safe to import from the Next.js client.
 */
export const PATIENT_NOT_FOUND_CODE = "PATIENT_NOT_FOUND";
export const PATIENT_NOT_FOUND_MESSAGE = "Patient not found";
export const NO_RECORD_TYPES_CODE = "NO_RECORD_TYPES";
export const NO_RECORD_TYPES_MESSAGE = "Choose at least one record type";
export const RECORD_TYPE_NOT_ALLOWED_CODE = "RECORD_TYPE_NOT_ALLOWED";
export const RECORD_TYPE_NOT_ALLOWED_MESSAGE =
  "Your role cannot request that record type";
export const NO_INDEXED_RECORDS_CODE = "NO_INDEXED_RECORDS";
export const NO_INDEXED_RECORDS_MESSAGE = "No records are indexed for this patient";
export const NO_SOURCE_FACILITY_CODE = "NO_SOURCE_FACILITY";
export const NO_SOURCE_FACILITY_MESSAGE =
  "Your account is not linked to a participating facility";
export const RECORDS_NOT_HELD_CODE = "RECORDS_NOT_HELD";
export const RECORDS_NOT_HELD_PREFIX = "Records not held at ";

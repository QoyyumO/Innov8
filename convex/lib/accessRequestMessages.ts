/**
 * Input-validation messages for access requests (INN-37).
 * Shared by the backend and the request form so wording cannot drift.
 * Safe to import from the Next.js client.
 */
export const PATIENT_NOT_FOUND_MESSAGE = "Patient not found";
export const NO_RECORD_TYPES_MESSAGE = "Choose at least one record type";
export const NO_INDEXED_RECORDS_MESSAGE = "No records are indexed for this patient";
export const NO_SOURCE_FACILITY_MESSAGE =
  "Your account is not linked to a participating facility";
export const RECORDS_NOT_HELD_PREFIX = "Records not held at ";

const FIXED_INPUT_ERROR_MESSAGES = [
  PATIENT_NOT_FOUND_MESSAGE,
  NO_RECORD_TYPES_MESSAGE,
  NO_INDEXED_RECORDS_MESSAGE,
  NO_SOURCE_FACILITY_MESSAGE,
] as const;

/**
 * Finds a known input-validation message inside a (possibly wrapped)
 * Convex error message. Returns null when none is present.
 */
export function findAccessRequestInputError(message: string): string | null {
  const fixedMessage = FIXED_INPUT_ERROR_MESSAGES.find((candidate) =>
    message.includes(candidate),
  );
  if (fixedMessage) {
    return fixedMessage;
  }
  const prefixIndex = message.indexOf(RECORDS_NOT_HELD_PREFIX);
  if (prefixIndex === -1) {
    return null;
  }
  const [line] = message.slice(prefixIndex).split("\n");
  return line.trim();
}

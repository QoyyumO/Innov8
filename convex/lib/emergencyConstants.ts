/**
 * Break-glass rules (INN-41). Shared by the backend and the UI; safe to
 * import from the Next.js client.
 */

/** Fixed on the server; clients cannot choose how long access lasts. */
export const EMERGENCY_ACCESS_TTL_MS = 15 * 60 * 1000;
export const JUSTIFICATION_MIN_LENGTH = 10;
export const JUSTIFICATION_MAX_LENGTH = 500;

export const JUSTIFICATION_TOO_SHORT_CODE = "JUSTIFICATION_TOO_SHORT";
export const JUSTIFICATION_TOO_SHORT_MESSAGE = `Explain the emergency in at least ${JUSTIFICATION_MIN_LENGTH} characters`;
export const JUSTIFICATION_TOO_LONG_CODE = "JUSTIFICATION_TOO_LONG";
export const JUSTIFICATION_TOO_LONG_MESSAGE = `Keep the justification under ${JUSTIFICATION_MAX_LENGTH} characters`;
export const EMERGENCY_ALREADY_ACTIVE_CODE = "EMERGENCY_ALREADY_ACTIVE";
export const EMERGENCY_ALREADY_ACTIVE_MESSAGE =
  "You already have active emergency access to this patient";
export const EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE = "EMERGENCY_REQUEST_NOT_ELIGIBLE";
export const EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE =
  "Break-glass can only be used on your own blocked or challenged single-patient request";
export const EMERGENCY_GRANT_NOT_FOUND_CODE = "EMERGENCY_GRANT_NOT_FOUND";
export const EMERGENCY_GRANT_NOT_FOUND_MESSAGE = "Emergency access not found";
export const EMERGENCY_GRANT_ALREADY_ENDED_CODE = "EMERGENCY_GRANT_ALREADY_ENDED";
export const EMERGENCY_GRANT_ALREADY_ENDED_MESSAGE = "Emergency access has already ended";

/**
 * Break-glass rules (INN-41). Shared by the backend and the UI; safe to
 * import from the Next.js client.
 */

/** Fixed on the server; clients cannot choose how long access lasts. */
export const EMERGENCY_ACCESS_TTL_MS = 15 * 60 * 1000;
export const JUSTIFICATION_MIN_LENGTH = 10;
export const JUSTIFICATION_MAX_LENGTH = 500;

export const JUSTIFICATION_TOO_SHORT_MESSAGE = `Explain the emergency in at least ${JUSTIFICATION_MIN_LENGTH} characters`;
export const JUSTIFICATION_TOO_LONG_MESSAGE = `Keep the justification under ${JUSTIFICATION_MAX_LENGTH} characters`;
export const EMERGENCY_ALREADY_ACTIVE_MESSAGE =
  "You already have active emergency access to this patient";
export const EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE =
  "Break-glass can only be used on your own blocked or challenged single-patient request";
export const EMERGENCY_GRANT_NOT_FOUND_MESSAGE = "Emergency access not found";
export const EMERGENCY_GRANT_ALREADY_ENDED_MESSAGE = "Emergency access has already ended";

const EMERGENCY_INPUT_ERROR_MESSAGES = [
  JUSTIFICATION_TOO_SHORT_MESSAGE,
  JUSTIFICATION_TOO_LONG_MESSAGE,
  EMERGENCY_ALREADY_ACTIVE_MESSAGE,
  EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE,
  EMERGENCY_GRANT_NOT_FOUND_MESSAGE,
  EMERGENCY_GRANT_ALREADY_ENDED_MESSAGE,
] as const;

/** Finds a known break-glass message inside a (possibly wrapped) Convex error. */
export function findEmergencyInputError(message: string): string | null {
  return (
    EMERGENCY_INPUT_ERROR_MESSAGES.find((candidate) => message.includes(candidate)) ??
    null
  );
}

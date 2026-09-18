/**
 * Patient consent rules (INN-45). Shared by the backend and the UI; safe to
 * import from the Next.js client.
 */

/** How long a consent recorded by a clinician lasts. Fixed on the server. */
export const CONSENT_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
/** How long the seeded demo consent for PAT-002391 lasts. */
export const DEMO_CONSENT_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export const CONSENT_NOTE_MIN_LENGTH = 10;
export const CONSENT_NOTE_MAX_LENGTH = 500;

/** Newest consents shown to reviewers (per index read). */
export const CONSENT_LIST_LIMIT = 50;

export const CONSENT_MISSING_REASON = "No active patient consent for the requesting facility";
export const CONSENT_ACTIVE_REASON = "Active patient consent for the requesting facility";

export const CONSENT_NOTE_TOO_SHORT_CODE = "CONSENT_NOTE_TOO_SHORT";
export const CONSENT_NOTE_TOO_SHORT_MESSAGE = `Describe how consent was given in at least ${CONSENT_NOTE_MIN_LENGTH} characters`;
export const CONSENT_NOTE_TOO_LONG_CODE = "CONSENT_NOTE_TOO_LONG";
export const CONSENT_NOTE_TOO_LONG_MESSAGE = `Keep the consent note under ${CONSENT_NOTE_MAX_LENGTH} characters`;
export const CONSENT_NOT_NEEDED_CODE = "CONSENT_NOT_NEEDED";
export const CONSENT_NOT_NEEDED_MESSAGE =
  "This patient's records are held at your facility, so no consent is needed";
export const CONSENT_ALREADY_ACTIVE_CODE = "CONSENT_ALREADY_ACTIVE";
export const CONSENT_ALREADY_ACTIVE_MESSAGE =
  "This patient already has active consent for your facility";
export const CONSENT_NOT_FOUND_CODE = "CONSENT_NOT_FOUND";
export const CONSENT_NOT_FOUND_MESSAGE = "Consent not found";
export const CONSENT_ALREADY_ENDED_CODE = "CONSENT_ALREADY_ENDED";
export const CONSENT_ALREADY_ENDED_MESSAGE = "This consent has already ended";
export const CONSENT_ALREADY_ACTIVE_PATIENT_MESSAGE =
  "You already have active consent for this facility";
export const CONSENT_NOT_NEEDED_PATIENT_MESSAGE =
  "Your records are already held at this facility, so no extra consent is needed";
export const PATIENT_NOT_LINKED_CODE = "PATIENT_NOT_LINKED";
export const PATIENT_NOT_LINKED_MESSAGE = "This login is not linked to a patient record";
export const FACILITY_NOT_FOUND_CODE = "FACILITY_NOT_FOUND";
export const FACILITY_NOT_FOUND_MESSAGE = "That facility is not in the exchange";

/**
 * Step-up verification for VERIFY decisions (INN-44).
 * Safe to import from the Next.js client.
 */

/** Wrong passwords allowed on one request before it is blocked. */
export const STEP_UP_MAX_FAILURES = 3;

export const STEP_UP_NOT_ELIGIBLE_CODE = "STEP_UP_NOT_ELIGIBLE";
export const STEP_UP_NOT_ELIGIBLE_MESSAGE =
  "Only your own single-patient request that needs verification can be verified";
export const STEP_UP_PASSWORD_REQUIRED_CODE = "STEP_UP_PASSWORD_REQUIRED";
export const STEP_UP_PASSWORD_REQUIRED_MESSAGE = "Enter your password to verify";
/** INN-45: a password cannot stand in for the patient's consent. */
export const STEP_UP_CONSENT_REQUIRED_CODE = "STEP_UP_CONSENT_REQUIRED";
export const STEP_UP_CONSENT_REQUIRED_MESSAGE =
  "Record the patient's consent on their page before verifying this request";

export const STEP_UP_VERIFIED_REASON =
  "Identity re-confirmed with the clinician's password (step-up)";
export const STEP_UP_ESCALATED_REASON = `Step-up verification failed ${STEP_UP_MAX_FAILURES} times`;

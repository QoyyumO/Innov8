/**
 * Tightly scoped clinical note after ALLOW (INN-81). Not an EMR editor.
 */

export const CLINICAL_NOTE_MIN_LENGTH = 10;
export const CLINICAL_NOTE_MAX_LENGTH = 500;
export const CLINICAL_NOTE_LIST_LIMIT = 20;

export const CLINICAL_WRITE_NOT_ALLOWED_CODE = "CLINICAL_WRITE_NOT_ALLOWED";
export const CLINICAL_WRITE_NOT_ALLOWED_MESSAGE =
  "You can only append a note after this request is allowed";

export const CLINICAL_NOTE_TOO_SHORT_CODE = "CLINICAL_NOTE_TOO_SHORT";
export const CLINICAL_NOTE_TOO_SHORT_MESSAGE = `Write at least ${CLINICAL_NOTE_MIN_LENGTH} characters`;
export const CLINICAL_NOTE_TOO_LONG_CODE = "CLINICAL_NOTE_TOO_LONG";
export const CLINICAL_NOTE_TOO_LONG_MESSAGE = `Keep the note under ${CLINICAL_NOTE_MAX_LENGTH} characters`;

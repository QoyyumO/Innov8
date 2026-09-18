import { ConvexError } from "convex/values";
import {
  ACCOUNT_SUSPENDED_CODE,
  PERMISSION_DENIED_CODE,
  SESSION_EXPIRED_CODE,
} from "./authConstants";

/**
 * Production Convex redacts a plain `Error` to "Server Error".
 * `ConvexError` keeps `{ code, message }` on the client as `error.data`.
 */

const APP_ERROR_CODES = [
  "ACCOUNT_SUSPENDED",
  "ALERT_INVALID_STATUS",
  "ALERT_NOT_FOUND",
  "CONSENT_ALREADY_ACTIVE",
  "CONSENT_ALREADY_ENDED",
  "CONSENT_NOT_FOUND",
  "CONSENT_NOT_NEEDED",
  "CONSENT_NOTE_TOO_LONG",
  "CONSENT_NOTE_TOO_SHORT",
  "CURRENT_PASSWORD_INCORRECT",
  "EMERGENCY_ALREADY_ACTIVE",
  "EMERGENCY_GRANT_ALREADY_ENDED",
  "EMERGENCY_GRANT_NOT_FOUND",
  "EMERGENCY_REQUEST_NOT_ELIGIBLE",
  "FACILITY_NOT_FOUND",
  "JUSTIFICATION_TOO_LONG",
  "JUSTIFICATION_TOO_SHORT",
  "NO_INDEXED_RECORDS",
  "NO_RECORD_TYPES",
  "NO_SOURCE_FACILITY",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_UNCHANGED",
  "PATIENT_NOT_FOUND",
  "PATIENT_NOT_LINKED",
  "PERMISSION_DENIED",
  "PROFILE_FIELD_REQUIRED",
  "PROFILE_FIELD_TOO_LONG",
  "RECORDS_NOT_HELD",
  "RESET_INVALID_TOKEN",
  "SESSION_EXPIRED",
  "STEP_UP_CONSENT_REQUIRED",
  "STEP_UP_NOT_ELIGIBLE",
  "STEP_UP_PASSWORD_REQUIRED",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const APP_ERROR_CODE_SET = new Set<string>(APP_ERROR_CODES);

export type AppErrorData = {
  code: AppErrorCode;
  message: string;
};

export function throwAppError(code: AppErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

function isAppErrorCodeValue(code: string): code is AppErrorCode {
  return APP_ERROR_CODE_SET.has(code);
}

function parseAppErrorData(data: unknown): AppErrorData | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("code" in data) ||
    !("message" in data)
  ) {
    return null;
  }
  const { code, message } = data as { code: unknown; message: unknown };
  if (typeof code !== "string" || typeof message !== "string") {
    return null;
  }
  if (!isAppErrorCodeValue(code)) {
    return null;
  }
  return { code, message };
}

function parseAppErrorFromMessage(message: string): AppErrorData | null {
  try {
    const fromWholeMessage = parseAppErrorData(JSON.parse(message));
    if (fromWholeMessage) {
      return fromWholeMessage;
    }
  } catch {
    // Wrapped Convex client text: `[CONVEX M(…)] … Uncaught ConvexError: {…}`
  }
  const payloadStart = message.indexOf('{"code":');
  if (payloadStart === -1) {
    return null;
  }
  const payloadEnd = message.lastIndexOf("}");
  if (payloadEnd <= payloadStart) {
    return null;
  }
  try {
    return parseAppErrorData(JSON.parse(message.slice(payloadStart, payloadEnd + 1)));
  } catch {
    return null;
  }
}

export function readAppError(error: unknown): AppErrorData | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  if ("data" in error) {
    const fromData = parseAppErrorData(error.data);
    if (fromData) {
      return fromData;
    }
  }
  if (error instanceof Error) {
    return parseAppErrorFromMessage(error.message);
  }
  return null;
}

export function isAppErrorCode(error: unknown, code: AppErrorCode): boolean {
  return readAppError(error)?.code === code;
}

const AUTH_ERROR_CODES = new Set<string>([
  SESSION_EXPIRED_CODE,
  ACCOUNT_SUSPENDED_CODE,
  PERMISSION_DENIED_CODE,
]);

/** Session / role failures that list queries swallow into empty / null. */
export function isAuthAppError(error: unknown): boolean {
  const appError = readAppError(error);
  return appError !== null && AUTH_ERROR_CODES.has(appError.code);
}

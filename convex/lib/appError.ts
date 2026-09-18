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

export type AppErrorData = {
  code: string;
  message: string;
};

export function throwAppError(code: string, message: string): never {
  throw new ConvexError({ code, message });
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
  return { code, message };
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
    try {
      return parseAppErrorData(JSON.parse(error.message));
    } catch {
      return null;
    }
  }
  return null;
}

export function isAppErrorCode(error: unknown, code: string): boolean {
  return readAppError(error)?.code === code;
}

/** Vitest: `await expect(promise).rejects.toSatisfy(appErrorCode(CODE))`. */
export function appErrorCode(code: string) {
  return (error: unknown) => isAppErrorCode(error, code);
}

const AUTH_ERROR_CODES = new Set([
  SESSION_EXPIRED_CODE,
  ACCOUNT_SUSPENDED_CODE,
  PERMISSION_DENIED_CODE,
]);

/** Session / role failures that list queries swallow into empty / null. */
export function isAuthAppError(error: unknown): boolean {
  const appError = readAppError(error);
  return appError !== null && AUTH_ERROR_CODES.has(appError.code);
}

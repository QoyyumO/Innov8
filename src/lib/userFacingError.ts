import { readAppError } from "../../convex/lib/appError";
import { findAuthErrorMessage } from "../../convex/lib/authConstants";

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return undefined;
}

export function toUserFacingError(error: unknown, genericMessage: string): string {
  const appError = readAppError(error);
  if (appError) {
    return appError.message;
  }
  const message = errorMessage(error);
  if (message !== undefined) {
    return findAuthErrorMessage(message) ?? genericMessage;
  }
  return genericMessage;
}

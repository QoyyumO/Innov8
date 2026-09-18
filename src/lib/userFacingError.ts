import { readAppError } from "../../convex/lib/appError";
import { findAuthErrorMessage } from "../../convex/lib/authConstants";

export function toUserFacingError(error: unknown, genericMessage: string): string {
  const appError = readAppError(error);
  if (appError) {
    return appError.message;
  }
  if (error instanceof Error) {
    return findAuthErrorMessage(error.message) ?? genericMessage;
  }
  return genericMessage;
}

import {
  ACCOUNT_SUSPENDED_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from "../../convex/lib/authConstants";

const KNOWN_AUTH_MESSAGES = new Set([
  SESSION_EXPIRED_MESSAGE,
  ACCOUNT_SUSPENDED_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
]);

export function toUserFacingError(error: unknown, genericMessage: string): string {
  const message = error instanceof Error ? error.message : "";
  if (KNOWN_AUTH_MESSAGES.has(message)) {
    return message;
  }
  return genericMessage;
}

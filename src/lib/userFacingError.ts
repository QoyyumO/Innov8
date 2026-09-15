import { isAuthErrorMessage } from "../../convex/lib/authConstants";

export function toUserFacingError(error: unknown, genericMessage: string): string {
  const message = error instanceof Error ? error.message : "";
  if (isAuthErrorMessage(message)) {
    return message;
  }
  return genericMessage;
}

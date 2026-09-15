export const MIN_PASSWORD_LENGTH = 6;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
export const RESET_GENERIC_MESSAGE =
  "If the account exists, reset instructions were sent.";
export const RESET_INVALID_TOKEN_MESSAGE = "Invalid or expired reset token";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";
export const ACCOUNT_SUSPENDED_MESSAGE =
  "Your account is suspended. Contact your administrator.";
export const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to perform this action";

export const AUTH_ERROR_MESSAGES = [
  SESSION_EXPIRED_MESSAGE,
  ACCOUNT_SUSPENDED_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
] as const;

export function isAuthErrorMessage(message: string): boolean {
  return (AUTH_ERROR_MESSAGES as readonly string[]).includes(message);
}

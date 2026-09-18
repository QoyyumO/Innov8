export const MIN_PASSWORD_LENGTH = 6;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
export const RESET_GENERIC_MESSAGE =
  "If the account exists, reset instructions were sent.";
export const RESET_INVALID_TOKEN_CODE = "RESET_INVALID_TOKEN";
export const RESET_INVALID_TOKEN_MESSAGE = "Invalid or expired reset token";
export const SESSION_EXPIRED_CODE = "SESSION_EXPIRED";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";
export const ACCOUNT_SUSPENDED_CODE = "ACCOUNT_SUSPENDED";
export const ACCOUNT_SUSPENDED_MESSAGE =
  "Your account is suspended. Contact your administrator.";
export const PERMISSION_DENIED_CODE = "PERMISSION_DENIED";
export const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to perform this action";

/** Known auth messages. `findAuthErrorMessage` matches them as substrings of a (possibly wrapped) client error. */
export const AUTH_ERROR_MESSAGES = [
  SESSION_EXPIRED_MESSAGE,
  ACCOUNT_SUSPENDED_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
] as const;

export function findAuthErrorMessage(message: string): string | undefined {
  return AUTH_ERROR_MESSAGES.find((known) => message.includes(known));
}

export function isAuthErrorMessage(message: string): boolean {
  return findAuthErrorMessage(message) !== undefined;
}
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
export const PASSWORD_TOO_SHORT_CODE = "PASSWORD_TOO_SHORT";
export const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
export const PASSWORD_UNCHANGED_CODE = "PASSWORD_UNCHANGED";
export const PASSWORD_UNCHANGED_MESSAGE =
  "New password must be different from current password";
export const CURRENT_PASSWORD_INCORRECT_CODE = "CURRENT_PASSWORD_INCORRECT";
export const CURRENT_PASSWORD_INCORRECT_MESSAGE = "Current password is incorrect";
export const PROFILE_FIELD_REQUIRED_CODE = "PROFILE_FIELD_REQUIRED";
export const PROFILE_FIELD_TOO_LONG_CODE = "PROFILE_FIELD_TOO_LONG";

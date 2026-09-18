import { describe, expect, test } from "vitest";
import { throwAppError } from "./appError";
import {
  ACCOUNT_SUSPENDED_MESSAGE,
  findAuthErrorMessage,
  isAuthErrorMessage,
  PERMISSION_DENIED_MESSAGE,
  SESSION_EXPIRED_CODE,
  SESSION_EXPIRED_MESSAGE,
} from "./authConstants";
import { toUserFacingError } from "../../src/lib/userFacingError";

function wrappedPlainAuthError(message: string): Error {
  return new Error(
    `[CONVEX M(records:viewAuthorisedSummary)] [Request ID: abc] Server Error\nUncaught Error: ${message}\n    at handler (../convex/lib/session.ts:81:11)`,
  );
}

describe("isAuthErrorMessage (INN-59)", () => {
  test("matches the raw session and permission messages", () => {
    expect(isAuthErrorMessage(SESSION_EXPIRED_MESSAGE)).toBe(true);
    expect(isAuthErrorMessage(PERMISSION_DENIED_MESSAGE)).toBe(true);
    expect(isAuthErrorMessage(ACCOUNT_SUSPENDED_MESSAGE)).toBe(true);
    expect(isAuthErrorMessage("The request could not be submitted. Try again.")).toBe(
      false,
    );
  });

  test("matches a wrapped Convex client Error", () => {
    const wrapped = wrappedPlainAuthError(SESSION_EXPIRED_MESSAGE);
    expect(isAuthErrorMessage(wrapped.message)).toBe(true);
    expect(findAuthErrorMessage(wrapped.message)).toBe(SESSION_EXPIRED_MESSAGE);
  });
});

describe("toUserFacingError (INN-59)", () => {
  test("returns the known auth message for a wrapped plain Convex error", () => {
    const genericMessage = "The request could not be submitted. Try again.";
    expect(
      toUserFacingError(wrappedPlainAuthError(SESSION_EXPIRED_MESSAGE), genericMessage),
    ).toBe(SESSION_EXPIRED_MESSAGE);
    expect(
      toUserFacingError(
        wrappedPlainAuthError(PERMISSION_DENIED_MESSAGE),
        genericMessage,
      ),
    ).toBe(PERMISSION_DENIED_MESSAGE);
  });

  test("still prefers ConvexError.data when present", () => {
    try {
      throwAppError(SESSION_EXPIRED_CODE, SESSION_EXPIRED_MESSAGE);
    } catch (error) {
      expect(toUserFacingError(error, "Try again.")).toBe(SESSION_EXPIRED_MESSAGE);
      return;
    }
    throw new Error("expected throwAppError to throw");
  });
});

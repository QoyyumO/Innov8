import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { isAppErrorCode, readAppError, throwAppError } from "./appError";
import { appErrorCode } from "./appError.testing";
import { PATIENT_NOT_FOUND_CODE, PATIENT_NOT_FOUND_MESSAGE } from "./accessRequestMessages";
import { SESSION_EXPIRED_CODE } from "./authConstants";

describe("appError", () => {
  test("throwAppError stores a typed code on ConvexError.data", () => {
    try {
      throwAppError(PATIENT_NOT_FOUND_CODE, PATIENT_NOT_FOUND_MESSAGE);
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect(readAppError(error)).toEqual({
        code: PATIENT_NOT_FOUND_CODE,
        message: PATIENT_NOT_FOUND_MESSAGE,
      });
      expect(isAppErrorCode(error, PATIENT_NOT_FOUND_CODE)).toBe(true);
      expect(appErrorCode(SESSION_EXPIRED_CODE)(error)).toBe(false);
      return;
    }
    throw new Error("expected throwAppError to throw");
  });

  test("readAppError ignores a plain Error", () => {
    expect(readAppError(new Error(PATIENT_NOT_FOUND_MESSAGE))).toBeNull();
  });

  test("readAppError recovers a payload from a JSON Error message", () => {
    const wrapped = new Error(
      JSON.stringify({
        code: PATIENT_NOT_FOUND_CODE,
        message: PATIENT_NOT_FOUND_MESSAGE,
      }),
    );
    expect(readAppError(wrapped)).toEqual({
      code: PATIENT_NOT_FOUND_CODE,
      message: PATIENT_NOT_FOUND_MESSAGE,
    });
  });

  test("readAppError recovers a payload from wrapped Convex client text", () => {
    const wrapped = new Error(
      `[CONVEX M(accessRequests:createAccessRequest)] [Request ID: abc] Server Error\nUncaught ConvexError: ${JSON.stringify(
        { code: PATIENT_NOT_FOUND_CODE, message: PATIENT_NOT_FOUND_MESSAGE },
      )}\n    at handler (../convex/accessRequests.ts:1:1)`,
    );
    expect(readAppError(wrapped)).toEqual({
      code: PATIENT_NOT_FOUND_CODE,
      message: PATIENT_NOT_FOUND_MESSAGE,
    });
  });
});

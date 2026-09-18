import { AppErrorCode, isAppErrorCode } from "./appError";

/** Vitest: `await expect(promise).rejects.toSatisfy(appErrorCode(CODE))`. */
export function appErrorCode(code: AppErrorCode) {
  return (error: unknown) => isAppErrorCode(error, code);
}

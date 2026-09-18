import { readAppError } from "../../convex/lib/appError";

export function toUserFacingError(error: unknown, genericMessage: string): string {
  return readAppError(error)?.message ?? genericMessage;
}

import { v } from "convex/values";
import { PERMISSION_DENIED_MESSAGE } from "./authConstants";

export const userRole = v.union(
  v.literal("doctor"),
  v.literal("nurse"),
  v.literal("pharmacist"),
  v.literal("laboratory"),
  v.literal("hospital_admin"),
  v.literal("system_admin"),
  v.literal("security_officer"),
  v.literal("patient"),
);

export type UserRole =
  | "doctor"
  | "nurse"
  | "pharmacist"
  | "laboratory"
  | "hospital_admin"
  | "system_admin"
  | "security_officer"
  | "patient";

export const CLINICIAN_ROLES: readonly UserRole[] = [
  "doctor",
  "nurse",
  "pharmacist",
  "laboratory",
];

export const SECURITY_ROLES: readonly UserRole[] = ["security_officer"];

export const ADMIN_ROLES: readonly UserRole[] = ["hospital_admin", "system_admin"];

/**
 * Throws unless the user holds at least one of `allowedRoles`.
 * Call after `requireSession`, e.g. `requireRole(user, CLINICIAN_ROLES)`.
 */
export function requireRole(
  user: { roles: readonly UserRole[] },
  allowedRoles: readonly UserRole[],
): void {
  const isAllowed = allowedRoles.some((role) => user.roles.includes(role));
  if (!isAllowed) {
    throw new Error(PERMISSION_DENIED_MESSAGE);
  }
}

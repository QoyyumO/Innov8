import { v } from "convex/values";
import { DatabaseReader } from "../_generated/server";
import { PERMISSION_DENIED_MESSAGE } from "./authConstants";
import { requireSession } from "./session";

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

/** Security officers and admins — audit/alert review (hospital admins are facility-scoped, INN-52). */
export const AUDIT_REVIEWER_ROLES: readonly UserRole[] = [
  ...SECURITY_ROLES,
  ...ADMIN_ROLES,
];

export function isAuditReviewer(user: { roles: readonly UserRole[] }): boolean {
  return AUDIT_REVIEWER_ROLES.some((role) => user.roles.includes(role));
}

/** Roles that review the whole exchange. */
export const GLOBAL_REVIEWER_ROLES: readonly UserRole[] = [...SECURITY_ROLES, "system_admin"];

/**
 * How much of the exchange a user may review (INN-52):
 * `global` — security officers and system admins;
 * `facility` — hospital admins (only activity involving their facility);
 * `none` — everyone else (their own activity only, where a view allows it).
 */
export type ReviewScope = "global" | "facility" | "none";

export function getReviewScope(user: { roles: readonly UserRole[] }): ReviewScope {
  if (GLOBAL_REVIEWER_ROLES.some((role) => user.roles.includes(role))) {
    return "global";
  }
  return user.roles.includes("hospital_admin") ? "facility" : "none";
}

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

/**
 * Session plus clinician role. Used by patient search and access requests.
 */
export async function requireClinicianSession(
  ctx: { db: DatabaseReader },
  token: string | undefined,
) {
  const sessionContext = await requireSession(ctx, token);
  requireRole(sessionContext.user, CLINICIAN_ROLES);
  return sessionContext;
}

/** Session plus patient role. Used by the patient portal (INN-46). */
export async function requirePatientSession(
  ctx: { db: DatabaseReader },
  token: string | undefined,
) {
  const sessionContext = await requireSession(ctx, token);
  requireRole(sessionContext.user, ["patient"]);
  return sessionContext;
}

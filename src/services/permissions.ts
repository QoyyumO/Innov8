import { UserRole } from "@/context/AuthContext";
import { CLINICIAN_ROLES } from "../../convex/lib/roles";

export function isDoctor(roles: UserRole[]) {
  return roles.includes("doctor");
}

export function isNurse(roles: UserRole[]) {
  return roles.includes("nurse");
}

export function isPharmacist(roles: UserRole[]) {
  return roles.includes("pharmacist");
}

export function isLaboratory(roles: UserRole[]) {
  return roles.includes("laboratory");
}

export function isSecurityOfficer(roles: UserRole[]) {
  return roles.includes("security_officer");
}

export function isAdmin(roles: UserRole[]) {
  return roles.includes("hospital_admin") || roles.includes("system_admin");
}

/**
 * Hospital admins review only activity involving their own facility (INN-52).
 * Mirrors `getReviewScope` in `convex/lib/roles.ts`.
 */
export function hasFacilityReviewScope(roles: UserRole[]) {
  return (
    roles.includes("hospital_admin") &&
    !roles.includes("system_admin") &&
    !roles.includes("security_officer")
  );
}

export function isPatient(roles: UserRole[]) {
  return roles.includes("patient");
}

export function isClinician(roles: UserRole[]) {
  return CLINICIAN_ROLES.some((role) => roles.includes(role));
}

import { UserRole } from "@/context/AuthContext";

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

export function isPatient(roles: UserRole[]) {
  return roles.includes("patient");
}

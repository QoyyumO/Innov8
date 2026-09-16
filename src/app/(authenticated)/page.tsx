"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  isAdmin,
  isLaboratory,
  isNurse,
  isPatient,
  isPharmacist,
  isSecurityOfficer,
} from "@/services/permissions";
import ClinicianDashboard from "./_components/ClinicianDashboard";
import SecurityDashboard from "./_components/SecurityDashboard";
import AdminDashboard from "./_components/AdminDashboard";
import PatientDashboard from "./_components/PatientDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  if (isPatient(roles)) {
    return <PatientDashboard />;
  }

  if (isSecurityOfficer(roles)) {
    return <SecurityDashboard />;
  }

  if (isAdmin(roles)) {
    return <AdminDashboard />;
  }

  if (isNurse(roles)) {
    return <ClinicianDashboard kind="nurse" />;
  }

  if (isPharmacist(roles)) {
    return <ClinicianDashboard kind="pharmacist" />;
  }

  if (isLaboratory(roles)) {
    return <ClinicianDashboard kind="laboratory" />;
  }

  return <ClinicianDashboard kind="doctor" />;
}

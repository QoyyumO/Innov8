"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  isAdmin,
  isClinician,
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

  if (isClinician(roles)) {
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

  if (isSecurityOfficer(roles)) {
    return <SecurityDashboard />;
  }

  if (isAdmin(roles)) {
    return <AdminDashboard />;
  }

  if (isPatient(roles)) {
    return <PatientDashboard />;
  }

  return <ClinicianDashboard kind="doctor" />;
}

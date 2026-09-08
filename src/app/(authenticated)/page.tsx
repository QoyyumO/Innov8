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
import DoctorDashboard from "./_components/DoctorDashboard";
import NurseDashboard from "./_components/NurseDashboard";
import PharmacistDashboard from "./_components/PharmacistDashboard";
import LaboratoryDashboard from "./_components/LaboratoryDashboard";
import SecurityDashboard from "./_components/SecurityDashboard";
import AdminDashboard from "./_components/AdminDashboard";
import PatientDashboard from "./_components/PatientDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles || [];

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
    return <NurseDashboard />;
  }

  if (isPharmacist(roles)) {
    return <PharmacistDashboard />;
  }

  if (isLaboratory(roles)) {
    return <LaboratoryDashboard />;
  }

  return <DoctorDashboard />;
}

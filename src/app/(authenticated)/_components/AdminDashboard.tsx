"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { DocsIcon, GroupIcon, LockIcon, UserIcon } from "@/icons";
import { WelcomeCard } from "./DashboardWidgets";

const facilities = [
  { name: "FMC Lagos", workers: 4, patients: 5200, status: "Connected" },
  { name: "FMC Abuja", workers: 3, patients: 4800, status: "Connected" },
  { name: "FMC Abeokuta", workers: 1, patients: 0, status: "Pilot" },
];

const workers = [
  { name: "Dr. Ibrahim Abdullahi", role: "Doctor", hospital: "FMC Abuja" },
  { name: "Nurse Fatima Bello", role: "Nurse", hospital: "FMC Abuja" },
  { name: "Amina Okeke", role: "Security officer", hospital: "Innov8 Exchange" },
  { name: "Dr. Yusuf Adewale", role: "Doctor", hospital: "FMC Abeokuta" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Administrator";

  return (
    <div>
      <PageBreadCrumb pageTitle="Admin dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Hospital administration"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push("/facilities")}>
              Facilities
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/audit")}
            >
              Audit trail
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Exchange overview"
          message="Dummy counts for the federated access layer. Facilities stay separate — Lagos and Abuja do not talk point-to-point."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Facilities"
            value="3"
            description="Lagos · Abuja · Abeokuta"
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Healthcare workers"
            value="8"
            description="Active demo accounts"
            icon={<UserIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Synthetic patients"
            value="10,000"
            description="Identities only"
            icon={<GroupIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Access events today"
            value="18"
            description="Search, request, view, alert"
            icon={<DocsIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard title="Participating facilities" desc="Dummy exchange membership.">
          <div className="space-y-3">
            {facilities.map((facility) => (
              <div
                key={facility.name}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 dark:border-gray-800"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90">
                    {facility.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {facility.workers} workers · {facility.patients.toLocaleString()} patients
                  </p>
                </div>
                <span className="text-sm text-success-600">{facility.status}</span>
              </div>
            ))}
          </div>
        </ComponentCard>

        <ComponentCard title="Recent workers" desc="Dummy directory — not a full HR system.">
          <div className="space-y-3">
            {workers.map((worker) => (
              <div
                key={worker.name}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 dark:border-gray-800"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90">
                    {worker.name}
                  </p>
                  <p className="text-sm text-gray-500">{worker.hospital}</p>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {worker.role}
                </span>
              </div>
            ))}
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

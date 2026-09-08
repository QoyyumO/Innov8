"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, TaskIcon, UserIcon } from "@/icons";
import { WelcomeCard, RequestsTable } from "./DashboardWidgets";
import { DEMO_PATIENT, nurseRequests } from "./dashboardDummy";

export default function NurseDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Nurse";

  return (
    <div>
      <PageBreadCrumb pageTitle="Nurse dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Nursing"
        >
          <div className="mt-4">
            <Button size="sm" onClick={() => router.push("/patients")}>
              Search assigned patient
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Ward view"
          message={`${DEMO_PATIENT.name} is visiting from ${DEMO_PATIENT.homeFacility}. Dummy data only — allergies and medications stay hidden until access is allowed.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Assigned patients"
            value="12"
            description="Emergency ward · this shift"
            icon={<UserIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Allergy checks"
            value="4"
            description="Allowed this morning"
            icon={<CheckCircleIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Pending verify"
            value="1"
            description="Vitals history · risk 36/100"
            icon={<TaskIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Nursing access requests"
          desc="Dummy requests scoped to allergies, medications, and notes."
        >
          <RequestsTable requests={nurseRequests} />
        </ComponentCard>
      </div>
    </div>
  );
}

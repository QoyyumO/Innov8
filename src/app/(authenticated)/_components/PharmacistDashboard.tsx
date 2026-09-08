"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, FileIcon, UserIcon } from "@/icons";
import { WelcomeCard, RequestsTable } from "./DashboardWidgets";
import { DEMO_PATIENT, pharmacistRequests } from "./dashboardDummy";

export default function PharmacistDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Pharmacist";

  return (
    <div>
      <PageBreadCrumb pageTitle="Pharmacist dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Pharmacy"
        >
          <div className="mt-4">
            <Button size="sm" onClick={() => router.push("/patients")}>
              Look up medication history
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Dispensing check"
          message={`Dummy view for ${DEMO_PATIENT.id}. Only allergy and medication fields are in scope for pharmacy requests.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Medication reviews"
            value="7"
            description="Today · this pharmacy"
            icon={<FileIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Allowed"
            value="6"
            description="Treatment purpose"
            icon={<CheckCircleIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Needs verify"
            value="1"
            description="Referral prescription history"
            icon={<UserIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Pharmacy access requests"
          desc="Dummy decisions for medication and allergy record types."
        >
          <RequestsTable requests={pharmacistRequests} />
        </ComponentCard>
      </div>
    </div>
  );
}

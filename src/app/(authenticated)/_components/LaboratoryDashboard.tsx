"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { AlertIcon, CheckCircleIcon, DocsIcon } from "@/icons";
import { WelcomeCard, RequestsTable } from "./DashboardWidgets";
import { DEMO_PATIENT, laboratoryRequests } from "./dashboardDummy";

export default function LaboratoryDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Scientist";

  return (
    <div>
      <PageBreadCrumb pageTitle="Laboratory dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Laboratory"
        >
          <div className="mt-4">
            <Button size="sm" onClick={() => router.push("/patients")}>
              Discover lab records
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Result discovery"
          message={`Dummy discovery for ${DEMO_PATIENT.id} at ${DEMO_PATIENT.homeFacility}. Existence is shown first — result values stay hidden until allowed.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Result lookups"
            value="9"
            description="Today · pathology"
            icon={<DocsIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Allowed"
            value="8"
            description="Treatment purpose"
            icon={<CheckCircleIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Blocked"
            value="1"
            description="Out-of-scope Abeokuta request"
            icon={<AlertIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Laboratory access requests"
          desc="Dummy existence checks for lab and pathology records."
        >
          <RequestsTable requests={laboratoryRequests} />
        </ComponentCard>
      </div>
    </div>
  );
}

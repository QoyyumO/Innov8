"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { AlertIcon, CheckCircleIcon, LockIcon, UserIcon } from "@/icons";
import { WelcomeCard, RequestsTable } from "./DashboardWidgets";
import { DEMO_PATIENT, doctorRequests } from "./dashboardDummy";

export default function DoctorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Doctor";

  return (
    <div>
      <PageBreadCrumb pageTitle="Doctor dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Clinician"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color="success">Synthetic data</Badge>
            <Button size="sm" onClick={() => router.push("/patients")}>
              Search patient
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/emergency")}
            >
              Break-glass
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Track C demo path"
          message={`Look up ${DEMO_PATIENT.id} (${DEMO_PATIENT.name}). Records exist at ${DEMO_PATIENT.homeFacility}. Request a treatment summary, then prove allow, block, and break-glass.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Open requests"
            value="3"
            description="Today at this facility"
            icon={<UserIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Last decision"
            value="ALLOW"
            description={`${DEMO_PATIENT.id} · risk 8/100`}
            icon={<CheckCircleIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Blocked harvest"
            value="1"
            description="500-record request · 94/100"
            icon={<AlertIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Emergency window"
            value="15m"
            description="Break-glass still active"
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Recent access requests"
          desc="Dummy decisions for the Lagos → Abuja demo. Contents are not shown until a request is allowed."
        >
          <RequestsTable requests={doctorRequests} />
        </ComponentCard>
      </div>
    </div>
  );
}

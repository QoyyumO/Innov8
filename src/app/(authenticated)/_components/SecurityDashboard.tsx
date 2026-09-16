"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { AlertIcon, DocsIcon, LockIcon, TimeIcon } from "@/icons";
import { WelcomeCard, RequestsTable } from "./DashboardWidgets";
import { doctorRequests } from "./dashboardDummy";
import { AlertsTable } from "../security/_components/AlertsTable";

export default function SecurityDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Security officer";

  return (
    <div>
      <PageBreadCrumb pageTitle="Security dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel="Security officer"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push("/security")}>
              Open alerts
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
          variant="error"
          title="High-risk block"
          message="Dr. Ibrahim requested 500 patient records. Risk 94/100. The request was blocked and this alert is waiting for review."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Open alerts"
            value="3"
            description="1 high · 1 medium · 1 low"
            icon={<AlertIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Blocked today"
            value="2"
            description="Mass harvest + out-of-scope lab"
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Break-glass"
            value="1"
            description="Active · 15 minutes left"
            icon={<TimeIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Audited events"
            value="18"
            description="Login, search, request, view"
            icon={<DocsIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Open security alerts"
          desc="Live queue — newest first. Review and resolve on the security page."
        >
          <AlertsTable status="open" pageSize={5} compact />
        </ComponentCard>

        <ComponentCard
          title="Watched access decisions"
          desc="Dummy clinician activity across participating facilities."
        >
          <RequestsTable requests={doctorRequests} />
        </ComponentCard>
      </div>
    </div>
  );
}

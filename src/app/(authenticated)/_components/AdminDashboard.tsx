"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useStartOfToday } from "@/hooks/useStartOfToday";
import { hasFacilityReviewScope } from "@/services/permissions";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { AlertIcon, DocsIcon, GroupIcon, LockIcon } from "@/icons";
import { formatBoundedCount } from "../../../../convex/lib/dashboardConstants";
import { LOADING_VALUE, WelcomeCard } from "./DashboardWidgets";
import { RecentDecisionsCard } from "./RecentDecisionsCard";
import { FacilitiesTable } from "../facilities/_components/FacilitiesTable";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const since = useStartOfToday();
  const isFacilityScoped = user !== null && hasFacilityReviewScope(user.roles);
  const scopeLabel = isFacilityScoped ? (user?.hospital ?? "your facility") : "the exchange";
  const dashboard = useQuery(
    api.dashboards.getSecurityDashboard,
    sessionToken ? { token: sessionToken, since } : "skip",
  );
  const facilities = useQuery(
    api.dashboards.listFacilities,
    sessionToken ? { token: sessionToken } : "skip",
  );
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
            <Button size="sm" variant="outline" onClick={() => router.push("/security")}>
              Security alerts
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/audit")}>
              Audit trail
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Exchange overview"
          message={
            isFacilityScoped
              ? `Alerts, blocks, audit events, and decisions below cover ${scopeLabel}: your staff, and requests to or from your facility. Facilities keep their own records; the exchange brokers each request and records it in the audit trail.`
              : "Facilities keep their own records — Lagos and Abuja do not talk point-to-point. The exchange brokers each request and records it in the audit trail."
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Facilities"
            value={facilities ? String(facilities.length) : LOADING_VALUE}
            description={facilities?.map((facility) => facility.city).join(" · ")}
            icon={<GroupIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Open alerts"
            value={
              dashboard
                ? formatBoundedCount(
                    dashboard.openAlerts.total.count,
                    dashboard.openAlerts.total.isCapped,
                  )
                : LOADING_VALUE
            }
            description={
              dashboard ? `${dashboard.openAlerts.high} high severity` : undefined
            }
            icon={<AlertIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Blocked today"
            value={
              dashboard
                ? formatBoundedCount(dashboard.blockedToday.count, dashboard.blockedToday.isCapped)
                : LOADING_VALUE
            }
            description="BLOCK decisions since midnight (Lagos)"
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Audited events today"
            value={
              dashboard
                ? formatBoundedCount(
                    dashboard.auditEventsToday.count,
                    dashboard.auditEventsToday.isCapped,
                  )
                : LOADING_VALUE
            }
            description="Sign-ins, searches, requests, views, alerts"
            icon={<DocsIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Participating facilities"
          desc="Live exchange membership."
        >
          <FacilitiesTable facilities={facilities} />
        </ComponentCard>

        <RecentDecisionsCard
          rows={dashboard?.recentDecisions}
          scopeLabel={isFacilityScoped ? scopeLabel : undefined}
        />
      </div>
    </div>
  );
}

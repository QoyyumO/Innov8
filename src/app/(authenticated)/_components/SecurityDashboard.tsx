"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import { useStartOfToday } from "@/hooks/useStartOfToday";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { AlertIcon, DocsIcon, LockIcon, TimeIcon } from "@/icons";
import { formatBoundedCount } from "../../../../convex/lib/dashboardConstants";
import {
  ActiveGrantsList,
  LOADING_VALUE,
  WelcomeCard,
} from "./DashboardWidgets";
import { minutesLeft } from "./emergencyLabels";
import { RecentDecisionsCard } from "./RecentDecisionsCard";
import { AlertsTable } from "../security/_components/AlertsTable";

export default function SecurityDashboard() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const now = useNow();
  const since = useStartOfToday();
  const dashboard = useQuery(
    api.dashboards.getSecurityDashboard,
    sessionToken ? { token: sessionToken, since } : "skip",
  );
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Security officer";

  const liveGrants = (dashboard?.activeGrants ?? []).filter(
    (grant) => grant.expiresAt > now,
  );
  const openAlerts = dashboard?.openAlerts;

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
            <Button size="sm" variant="outline" onClick={() => router.push("/audit")}>
              Audit trail
            </Button>
          </div>
        </WelcomeCard>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Open alerts"
            value={
              openAlerts
                ? formatBoundedCount(openAlerts.total.count, openAlerts.total.isCapped)
                : LOADING_VALUE
            }
            description={
              openAlerts
                ? `${openAlerts.high} high · ${openAlerts.medium} medium · ${openAlerts.low} low`
                : undefined
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
            title="Break-glass"
            value={dashboard ? String(liveGrants.length) : LOADING_VALUE}
            description={
              liveGrants.length > 0
                ? `Next ends in ${minutesLeft(liveGrants[0].expiresAt, now)} min`
                : "No active emergency access"
            }
            icon={<TimeIcon className="h-6 w-6 text-brand-500" />}
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

        {liveGrants.length > 0 && (
          <ComponentCard
            title="Active break-glass"
            desc="Soonest to expire first. Revoke from the security page if a grant looks wrong."
          >
            <ActiveGrantsList grants={liveGrants} now={now} showHolder />
          </ComponentCard>
        )}

        <ComponentCard
          title="Open security alerts"
          desc="Live queue — newest first. Review and resolve on the security page."
        >
          <AlertsTable status="open" pageSize={5} compact />
        </ComponentCard>

        <RecentDecisionsCard rows={dashboard?.recentDecisions} />
      </div>
    </div>
  );
}

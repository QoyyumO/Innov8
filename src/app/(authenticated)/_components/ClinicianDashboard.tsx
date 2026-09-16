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
import EmptyState from "@/components/empty-state/EmptyState";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { AlertIcon, CheckCircleIcon, FileIcon, LockIcon } from "@/icons";
import { formatBoundedCount } from "../../../../convex/lib/dashboardConstants";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../convex/lib/demoIds";
import { OUTCOME_LABELS, formatRequestTime } from "./accessLabels";
import {
  ActiveGrantsList,
  DashboardRequestsTable,
  LOADING_VALUE,
  WelcomeCard,
} from "./DashboardWidgets";
import { minutesLeft } from "./emergencyLabels";

export type ClinicianKind = "doctor" | "nurse" | "pharmacist" | "laboratory";

const CLINICIAN_COPY: Record<
  ClinicianKind,
  { pageTitle: string; roleLabel: string; searchLabel: string; tipTitle: string; tip: string }
> = {
  doctor: {
    pageTitle: "Doctor dashboard",
    roleLabel: "Clinician",
    searchLabel: "Search patient",
    tipTitle: "Track C demo path",
    tip: `Look up ${DEMO_PATIENT_PUBLIC_ID}, request a treatment summary, then try the bulk-harvest simulation and break-glass. The cards below follow your own requests.`,
  },
  nurse: {
    pageTitle: "Nurse dashboard",
    roleLabel: "Nursing",
    searchLabel: "Search patient",
    tipTitle: "Ward view",
    tip: `Look up ${DEMO_PATIENT_PUBLIC_ID} and ask only for what the shift needs — allergies and medications are released once a request is allowed.`,
  },
  pharmacist: {
    pageTitle: "Pharmacist dashboard",
    roleLabel: "Pharmacy",
    searchLabel: "Look up a patient",
    tipTitle: "Dispensing check",
    tip: "Request allergies and medications only; everything else stays with the holding facility.",
  },
  laboratory: {
    pageTitle: "Laboratory dashboard",
    roleLabel: "Laboratory",
    searchLabel: "Discover records",
    tipTitle: "Result discovery",
    tip: "Search shows which facility holds a patient's records; contents stay hidden until a request is allowed.",
  },
};

export default function ClinicianDashboard({ kind }: { kind: ClinicianKind }) {
  const copy = CLINICIAN_COPY[kind];
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const now = useNow();
  const since = useStartOfToday();
  const dashboard = useQuery(
    api.dashboards.getClinicianDashboard,
    sessionToken ? { token: sessionToken, since } : "skip",
  );
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : copy.roleLabel;

  const liveGrants = (dashboard?.activeGrants ?? []).filter(
    (grant) => grant.expiresAt > now,
  );
  const today = dashboard?.today;
  const lastDecision = dashboard?.lastDecision;
  const blockedHarvest = dashboard?.latestBlockedHarvest;

  return (
    <div>
      <PageBreadCrumb pageTitle={copy.pageTitle} />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department={user?.department}
          roleLabel={copy.roleLabel}
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color="success">Synthetic data</Badge>
            <Button size="sm" onClick={() => router.push("/patients")}>
              {copy.searchLabel}
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/requests")}>
              My requests
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/emergency")}>
              Break-glass
            </Button>
          </div>
        </WelcomeCard>

        <Alert variant="info" title={copy.tipTitle} message={copy.tip} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Requests today"
            value={today ? formatBoundedCount(today.total.count, today.total.isCapped) : LOADING_VALUE}
            description={
              today
                ? `${today.allowed} allowed · ${today.challenged} verify · ${today.blocked} blocked`
                : undefined
            }
            icon={<FileIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Last decision"
            value={
              dashboard === undefined
                ? LOADING_VALUE
                : lastDecision?.outcome
                  ? OUTCOME_LABELS[lastDecision.outcome]
                  : "None yet"
            }
            description={
              lastDecision
                ? `${lastDecision.publicId} · risk ${lastDecision.riskScore}/100`
                : "Your newest decided request"
            }
            icon={<CheckCircleIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Blocked harvest"
            value={dashboard === undefined ? LOADING_VALUE : blockedHarvest ? "Blocked" : "None"}
            description={
              blockedHarvest
                ? `${blockedHarvest.recordCount.toLocaleString()} records · ${blockedHarvest.riskScore}/100 · ${formatRequestTime(blockedHarvest.requestedAt)}`
                : "Among your recent requests"
            }
            icon={<AlertIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Break-glass"
            value={
              dashboard === undefined
                ? LOADING_VALUE
                : liveGrants.length > 0
                  ? `${minutesLeft(liveGrants[0].expiresAt, now)} min`
                  : "Inactive"
            }
            description={
              liveGrants.length > 0
                ? `${liveGrants[0].publicId} · ${liveGrants.length} active`
                : "No emergency access right now"
            }
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        {liveGrants.length > 0 && (
          <ComponentCard
            title="Active emergency access"
            desc="Temporary and audited. Open the request to view records or end access early."
          >
            <ActiveGrantsList grants={liveGrants} now={now} />
          </ComponentCard>
        )}

        <ComponentCard
          title="Recent access requests"
          desc="Your newest requests and their decisions. Clinical contents open only from an allowed request."
        >
          {dashboard && dashboard.recentRequests.length > 0 ? (
            <DashboardRequestsTable rows={dashboard.recentRequests} />
          ) : (
            <EmptyState
              title={dashboard === undefined ? "Loading requests…" : "No requests yet"}
              description={`Search for ${DEMO_PATIENT_PUBLIC_ID} and request access to see decisions here.`}
              icon={<FileIcon className="h-12 w-12 text-brand-500" />}
            />
          )}
        </ComponentCard>
      </div>
    </div>
  );
}

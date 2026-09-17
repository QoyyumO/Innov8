"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EyeIcon } from "@/icons";
import { PURPOSE_LABELS, formatRequestTime } from "./accessLabels";
import { AUDIT_ACTION_BADGE_COLORS, AUDIT_ACTION_LABELS } from "./auditLabels";
import { WelcomeCard } from "./DashboardWidgets";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

export default function PatientDashboard() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const dashboard = useQuery(
    api.dashboards.getPatientDashboard,
    sessionToken ? { token: sessionToken } : "skip",
  );
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Patient";
  const hospital = dashboard?.homeFacility.name ?? user?.hospital;

  return (
    <div>
      <PageBreadCrumb pageTitle="Patient dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={hospital}
          department={dashboard ? `${dashboard.homeFacility.city} · home facility` : "Home facility"}
          roleLabel="Patient"
        >
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={() => router.push("/audit")}>
              My sign-in activity
            </Button>
          </div>
        </WelcomeCard>

        {dashboard && (
          <ComponentCard title="Your identity" desc="Synthetic record metadata only — not a full chart.">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Patient ID
                </dt>
                <dd className="mt-1 font-mono text-sm text-charcoal dark:text-white/90">
                  {dashboard.publicId}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Name on record
                </dt>
                <dd className="mt-1 text-sm text-charcoal dark:text-white/90">
                  {dashboard.profile.firstName} {dashboard.profile.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Home facility
                </dt>
                <dd className="mt-1 text-sm text-charcoal dark:text-white/90">
                  {dashboard.homeFacility.name} ({dashboard.homeFacility.code})
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  City
                </dt>
                <dd className="mt-1 text-sm text-charcoal dark:text-white/90">
                  {dashboard.homeFacility.city}
                </dd>
              </div>
            </dl>
          </ComponentCard>
        )}

        <Alert
          variant="info"
          title="Your records stay at your facility"
          message="Innov8 does not copy your records. Clinicians at other hospitals must request access for a stated purpose, and every request is audited."
        />

        <ComponentCard
          title="Who accessed your records"
          desc="A history of clinicians who requested or viewed your records."
        >
          {dashboard === undefined ? (
            <div className="flex justify-center py-10">
              <Loading />
            </div>
          ) : dashboard === null ? (
            <EmptyState
              title="Record not linked yet"
              description="This login is not linked to a patient record. After the synthetic seed, Chioma sees PAT-002391 and the clinicians who requested her records."
              icon={<EyeIcon className="h-12 w-12 text-brand-500" />}
            />
          ) : dashboard.recentEvents.length === 0 ? (
            <EmptyState
              title="No access history yet"
              description="When a clinician requests or views your records, the event will appear here."
              icon={<EyeIcon className="h-12 w-12 text-brand-500" />}
            />
          ) : (
            <div className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-800">
                    <TableCell isHeader className={HEADER_CELL_CLASS}>
                      Time
                    </TableCell>
                    <TableCell isHeader className={HEADER_CELL_CLASS}>
                      Who
                    </TableCell>
                    <TableCell isHeader className={HEADER_CELL_CLASS}>
                      Action
                    </TableCell>
                    <TableCell isHeader className={HEADER_CELL_CLASS}>
                      Purpose
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dashboard.recentEvents.map((event) => (
                    <TableRow
                      key={event.eventId}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell className="px-4 py-3 align-top text-sm whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {formatRequestTime(event.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                        {event.actor ? (
                          <>
                            <span className="font-medium">{event.actor.name}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              {event.actor.hospital}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">System</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top whitespace-nowrap">
                        <Badge color={AUDIT_ACTION_BADGE_COLORS[event.action]} size="sm">
                          {AUDIT_ACTION_LABELS[event.action]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                        {event.purpose ? PURPOSE_LABELS[event.purpose] : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {dashboard.isHistoryCapped && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing the {dashboard.recentEvents.length} most recent events.
              </p>
            )}
            </div>
          )}
        </ComponentCard>
      </div>
    </div>
  );
}

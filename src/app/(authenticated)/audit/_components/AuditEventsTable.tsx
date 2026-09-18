"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import Label from "@/components/form/Label";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocsIcon } from "@/icons";
import type { AuditAction, DecisionOutcome } from "../../../../../convex/lib/domain";
import { startOfLagosDay } from "../../../../../convex/lib/dashboardConstants";
import Input from "@/components/form/input/InputField";
import { formatRequestTime } from "../../_components/accessLabels";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_BADGE_COLORS,
  AUDIT_ACTION_LABELS,
  findAuditRequestId,
  summarizeAuditDetails,
} from "../../_components/auditLabels";

const PAGE_SIZE = 25;
const ALL_ACTIONS = "all";
const ALL_OUTCOMES = "all";
const ALL_FACILITIES = "all";
const LAGOS_DAY_MS = 24 * 60 * 60 * 1000;
const SELECT_CLASS =
  "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

const ACTION_OPTIONS = [
  { value: ALL_ACTIONS, label: "All actions" },
  ...AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] })),
];

const OUTCOME_OPTIONS: { value: typeof ALL_OUTCOMES | DecisionOutcome; label: string }[] = [
  { value: ALL_OUTCOMES, label: "All decisions" },
  { value: "ALLOW", label: "ALLOW" },
  { value: "VERIFY", label: "VERIFY" },
  { value: "BLOCK", label: "BLOCK" },
];

function lagosDateBound(isoDate: string, bound: "start" | "end"): number | undefined {
  if (isoDate === "") {
    return undefined;
  }
  const parsed = Date.parse(`${isoDate}T12:00:00+01:00`);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  const start = startOfLagosDay(parsed);
  return bound === "start" ? start : start + LAGOS_DAY_MS - 1;
}

function actorDisplayName(actor: { name: string; email: string }): string {
  return actor.name || actor.email || "Unknown actor";
}

type AuditEventsTableProps = {
  /** Security officers and admins can open one person's trail. */
  canFilterByActor: boolean;
  actorId?: string;
  /** Display name from the audit link, so an empty action filter still names the person. */
  actorLabel?: string;
};

export function AuditEventsTable({ canFilterByActor, actorId, actorLabel }: AuditEventsTableProps) {
  const { sessionToken } = useAuth();
  const [action, setAction] = useState<AuditAction | undefined>(undefined);
  const [patientPublicId, setPatientPublicId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [outcome, setOutcome] = useState<DecisionOutcome | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const facilities = useQuery(
    api.dashboards.listFacilities,
    canFilterByActor && sessionToken ? { token: sessionToken } : "skip",
  );
  const createdFrom = canFilterByActor ? lagosDateBound(fromDate, "start") : undefined;
  const createdTo = canFilterByActor ? lagosDateBound(toDate, "end") : undefined;
  const trimmedPublicId = patientPublicId.trim();
  const { results, status, loadMore } = usePaginatedQuery(
    api.audit.listAuditEvents,
    sessionToken
      ? {
          token: sessionToken,
          action,
          actorId,
          patientPublicId:
            canFilterByActor && trimmedPublicId !== "" ? trimmedPublicId : undefined,
          facilityId: canFilterByActor && facilityId !== "" ? facilityId : undefined,
          outcome: canFilterByActor ? outcome : undefined,
          createdFrom,
          createdTo,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const matchingActor = actorId
    ? results.find((event) => event.actor?.actorId === actorId)?.actor
    : undefined;
  const filteredActorName =
    actorLabel || (matchingActor ? actorDisplayName(matchingActor) : undefined);

  const handleActionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setAction(value === ALL_ACTIONS ? undefined : (value as AuditAction));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <Label htmlFor="audit-action-filter">Action</Label>
          <select
            id="audit-action-filter"
            value={action ?? ALL_ACTIONS}
            onChange={handleActionChange}
            className={SELECT_CLASS}
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {canFilterByActor && (
          <>
            <div className="w-full max-w-xs">
              <Label htmlFor="audit-patient-filter">Patient ID</Label>
              <Input
                id="audit-patient-filter"
                name="patientPublicId"
                value={patientPublicId}
                onChange={(event) => setPatientPublicId(event.target.value)}
                placeholder="PAT-002391"
              />
            </div>
            <div className="w-full max-w-xs">
              <Label htmlFor="audit-facility-filter">Facility</Label>
              <select
                id="audit-facility-filter"
                value={facilityId === "" ? ALL_FACILITIES : facilityId}
                onChange={(event) =>
                  setFacilityId(
                    event.target.value === ALL_FACILITIES ? "" : event.target.value,
                  )
                }
                className={SELECT_CLASS}
              >
                <option value={ALL_FACILITIES}>All facilities in scope</option>
                {(facilities ?? []).map((facility) => (
                  <option key={facility.facilityId} value={facility.facilityId}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full max-w-xs">
              <Label htmlFor="audit-outcome-filter">Decision</Label>
              <select
                id="audit-outcome-filter"
                value={outcome ?? ALL_OUTCOMES}
                onChange={(event) => {
                  const value = event.target.value;
                  setOutcome(value === ALL_OUTCOMES ? undefined : (value as DecisionOutcome));
                }}
                className={SELECT_CLASS}
              >
                {OUTCOME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full max-w-[11rem]">
              <Label htmlFor="audit-from-date">From (Lagos)</Label>
              <Input
                id="audit-from-date"
                name="createdFrom"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="w-full max-w-[11rem]">
              <Label htmlFor="audit-to-date">To (Lagos)</Label>
              <Input
                id="audit-to-date"
                name="createdTo"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </>
        )}
        {actorId && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing events by {filteredActorName ?? "this person"} ·{" "}
            <Link
              href="/audit"
              className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Show everyone
            </Link>
          </p>
        )}
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="flex justify-center py-10">
          <Loading />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No audit events"
          description={
            action || trimmedPublicId || facilityId || outcome || fromDate || toDate
              ? "Nothing matches these filters."
              : "Nothing has been recorded yet."
          }
          icon={<DocsIcon className="h-12 w-12 text-brand-500" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-gray-800">
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Time
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Actor
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Action
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Entity
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Details
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((event) => {
                const requestId = findAuditRequestId(event);
                const detailPairs = summarizeAuditDetails(event.details);
                return (
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
                          {canFilterByActor && event.actor.actorId !== actorId ? (
                            <Link
                              href={`/audit?actorId=${encodeURIComponent(event.actor.actorId)}&actorName=${encodeURIComponent(actorDisplayName(event.actor))}`}
                              className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                            >
                              {actorDisplayName(event.actor)}
                            </Link>
                          ) : (
                            <span className="font-medium">{actorDisplayName(event.actor)}</span>
                          )}
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
                      <span className="font-mono text-xs">{event.entity}</span>
                      {requestId && (
                        <Link
                          href={`/requests/${requestId}`}
                          className="block text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                        >
                          View request
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-400">
                      {detailPairs.length === 0 ? (
                        "—"
                      ) : (
                        <dl className="max-w-md space-y-0.5">
                          {detailPairs.map((pair) => (
                            <div key={pair.label} className="flex gap-1">
                              <dt className="shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                {pair.label}:
                              </dt>
                              <dd className="break-words">{pair.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(PAGE_SIZE)}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

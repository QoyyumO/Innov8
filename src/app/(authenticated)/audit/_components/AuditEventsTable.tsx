"use client";

import { useState } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocsIcon } from "@/icons";
import type { AuditAction } from "../../../../../convex/lib/domain";
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

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

const ACTION_OPTIONS = [
  { value: ALL_ACTIONS, label: "All actions" },
  ...AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] })),
];

type AuditEventsTableProps = {
  /** Security officers and admins can open one person's trail. */
  canFilterByActor: boolean;
  actorId?: string;
};

export function AuditEventsTable({ canFilterByActor, actorId }: AuditEventsTableProps) {
  const { sessionToken } = useAuth();
  const [action, setAction] = useState<AuditAction | undefined>(undefined);
  const { results, status, loadMore } = usePaginatedQuery(
    api.audit.listAuditEvents,
    sessionToken ? { token: sessionToken, action, actorId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const handleActionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setAction(value === ALL_ACTIONS ? undefined : (value as AuditAction));
  };

  const filteredActorName = actorId ? results[0]?.actor?.name : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xs">
          <Label htmlFor="audit-action-filter">Action</Label>
          <Select
            options={ACTION_OPTIONS}
            defaultValue={ALL_ACTIONS}
            onChange={handleActionChange}
          />
        </div>
        {actorId && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing events by {filteredActorName ?? "one person"} ·{" "}
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
            action
              ? `Nothing recorded for “${AUDIT_ACTION_LABELS[action]}” yet.`
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
                              href={`/audit?actorId=${encodeURIComponent(event.actor.actorId)}`}
                              className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                            >
                              {event.actor.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{event.actor.name}</span>
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

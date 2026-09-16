"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertIcon } from "@/icons";
import { toUserFacingError } from "@/lib/userFacingError";
import type { AlertStatus } from "../../../../../convex/lib/domain";
import { findEmergencyInputError } from "../../../../../convex/lib/emergencyConstants";
import { OUTCOME_BADGE_COLORS, formatRequestTime } from "../../_components/accessLabels";
import {
  ALERT_SEVERITY_BADGE_COLORS,
  ALERT_STATUS_BADGE_COLORS,
  ALERT_STATUS_LABELS,
} from "../../_components/alertLabels";
import { describeGrantStatus, isGrantLive } from "../../_components/emergencyLabels";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

type AlertsTableProps = {
  status?: AlertStatus;
  pageSize?: number;
  /** Hide actions and paging, for dashboard previews. */
  compact?: boolean;
};

type PendingAction = { alertId: string; action: "acknowledge" | "close" };

export function AlertsTable({ status, pageSize = 10, compact = false }: AlertsTableProps) {
  const { sessionToken } = useAuth();
  const { results, status: loadStatus, loadMore } = usePaginatedQuery(
    api.alerts.listSecurityAlerts,
    sessionToken ? { token: sessionToken, status } : "skip",
    { initialNumItems: pageSize },
  );
  const acknowledgeAlert = useMutation(api.alerts.acknowledgeAlert);
  const closeAlert = useMutation(api.alerts.closeAlert);
  const revokeEmergencyAccess = useMutation(api.emergency.revokeEmergencyAccess);
  const now = useNow();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAction = async (alertId: string, action: PendingAction["action"]) => {
    if (!sessionToken) {
      return;
    }
    setErrorMessage(null);
    setPendingAction({ alertId, action });
    try {
      const mutate = action === "acknowledge" ? acknowledgeAlert : closeAlert;
      await mutate({ token: sessionToken, alertId });
    } catch (error) {
      console.error(`Error trying to ${action} alert:`, error);
      const message = error instanceof Error ? error.message : "";
      const alreadyMatch = message.match(/Alert is already \w+/);
      setErrorMessage(
        alreadyMatch?.[0] ?? toUserFacingError(error, "The alert could not be updated. Try again."),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const revokeGrant = async (grantId: string) => {
    if (!sessionToken) {
      return;
    }
    setErrorMessage(null);
    setRevokingGrantId(grantId);
    try {
      await revokeEmergencyAccess({ token: sessionToken, grantId });
    } catch (error) {
      console.error("Error revoking emergency access:", error);
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(
        findEmergencyInputError(message) ??
          toUserFacingError(error, "Emergency access could not be revoked. Try again."),
      );
    } finally {
      setRevokingGrantId(null);
    }
  };

  if (loadStatus === "LoadingFirstPage") {
    return (
      <div className="flex justify-center py-10">
        <Loading />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title={status ? `No ${ALERT_STATUS_LABELS[status].toLowerCase()} alerts` : "No alerts"}
        description="Blocked access requests raise alerts here. Try the bulk-harvest simulation on the access requests page."
        icon={<AlertIcon className="h-12 w-12 text-brand-500" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Alert not updated" message={errorMessage} />
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Alert
              </TableCell>
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Requester
              </TableCell>
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Request
              </TableCell>
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Risk
              </TableCell>
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Status
              </TableCell>
              {!compact && (
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {results.map((alert) => {
              const isPending = pendingAction?.alertId === alert.alertId;
              return (
                <TableRow
                  key={alert.alertId}
                  className={
                    alert.isHarvest && alert.status === "open"
                      ? "bg-error-50 dark:bg-error-500/10"
                      : "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }
                >
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {alert.title}
                      </span>
                      <Badge color={ALERT_SEVERITY_BADGE_COLORS[alert.severity]} size="sm">
                        {alert.severity}
                      </Badge>
                      {alert.isHarvest && (
                        <Badge color="error" variant="solid" size="sm">
                          Harvest
                        </Badge>
                      )}
                      {alert.emergency && (
                        <Badge color="warning" variant="solid" size="sm">
                          Break-glass
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-300">
                      {alert.message}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatRequestTime(alert.createdAt)}
                    </p>
                    {alert.emergency && (
                      <p className="mt-1 text-xs font-medium text-warning-600 dark:text-orange-400">
                        {describeGrantStatus(alert.emergency, now)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                    {alert.requester ? (
                      <>
                        <span className="font-medium">{alert.requester.name}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {alert.requester.hospital}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                    {alert.requestId ? (
                      <Link
                        href={`/requests/${alert.requestId}`}
                        className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                      >
                        {alert.publicId ?? "View request"}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {alert.recordCount !== null && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {alert.recordCount === 1
                          ? "1 patient record"
                          : `${alert.recordCount} patient records`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-nowrap">
                    {alert.riskScore !== null && alert.outcome !== null ? (
                      <Badge color={OUTCOME_BADGE_COLORS[alert.outcome]} size="sm">
                        {alert.outcome} · {alert.riskScore}/100
                      </Badge>
                    ) : alert.emergency ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Override
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Badge color={ALERT_STATUS_BADGE_COLORS[alert.status]} size="sm">
                      {ALERT_STATUS_LABELS[alert.status]}
                    </Badge>
                  </TableCell>
                  {!compact && (
                    <TableCell className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {alert.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => runAction(alert.alertId, "acknowledge")}
                          >
                            {isPending && pendingAction?.action === "acknowledge"
                              ? "Saving…"
                              : "Acknowledge"}
                          </Button>
                        )}
                        {alert.status !== "closed" && (
                          <Button
                            size="sm"
                            variant="text-only"
                            disabled={isPending}
                            onClick={() => runAction(alert.alertId, "close")}
                          >
                            {isPending && pendingAction?.action === "close" ? "Saving…" : "Close"}
                          </Button>
                        )}
                        {alert.emergency && isGrantLive(alert.emergency, now) && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={revokingGrantId === alert.emergency.grantId}
                            onClick={() => revokeGrant(alert.emergency!.grantId)}
                          >
                            {revokingGrantId === alert.emergency.grantId
                              ? "Revoking…"
                              : "Revoke access"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!compact && (loadStatus === "CanLoadMore" || loadStatus === "LoadingMore") && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loadStatus === "LoadingMore"}
            onClick={() => loadMore(pageSize)}
          >
            {loadStatus === "LoadingMore" ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

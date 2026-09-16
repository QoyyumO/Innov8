"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { FunctionReturnType } from "convex/server";
import { api } from "@/lib/convex";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OUTCOME_BADGE_COLORS,
  PURPOSE_LABELS,
  formatRequestTime,
} from "./accessLabels";
import { minutesLeft } from "./emergencyLabels";

export type DashboardRow = NonNullable<
  FunctionReturnType<typeof api.dashboards.getClinicianDashboard>
>["recentRequests"][number];

export type ActiveGrantRow = NonNullable<
  FunctionReturnType<typeof api.dashboards.getClinicianDashboard>
>["activeGrants"][number];

/** Placeholder while a dashboard query loads. */
export const LOADING_VALUE = "…";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

export function WelcomeCard({
  name,
  hospital,
  department,
  roleLabel,
  children,
}: {
  name: string;
  hospital?: string;
  department?: string;
  roleLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">{roleLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">
        Welcome back, {name}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {[hospital, department].filter(Boolean).join(" · ")}
      </p>
      {children}
    </div>
  );
}

function describeVolume(recordCount: number): string {
  return recordCount === 1 ? "1 patient" : `${recordCount.toLocaleString()} records`;
}

export function DashboardRequestsTable({
  rows,
  showRequester = false,
}: {
  rows: DashboardRow[];
  showRequester?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800">
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Patient
            </TableCell>
            {showRequester && (
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Requester
              </TableCell>
            )}
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Purpose
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Holding facility
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Decision
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Time
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <TableRow
              key={row.requestId}
              className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <TableCell className="px-4 py-4 align-top">
                <Link
                  href={`/requests/${row.requestId}`}
                  className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  {row.publicId}
                </Link>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {describeVolume(row.recordCount)}
                </div>
              </TableCell>
              {showRequester && (
                <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                  {row.requester ? (
                    <>
                      <span className="font-medium">{row.requester.name}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {row.requester.hospital}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell className="px-4 py-4 align-top text-sm text-gray-600 dark:text-gray-300">
                {PURPOSE_LABELS[row.purpose]}
              </TableCell>
              <TableCell className="px-4 py-4 align-top text-sm text-gray-600 dark:text-gray-300">
                {row.targetFacility}
              </TableCell>
              <TableCell className="px-4 py-4 align-top whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                  {row.outcome !== null && row.riskScore !== null ? (
                    <Badge color={OUTCOME_BADGE_COLORS[row.outcome]} size="sm">
                      {row.outcome} · {row.riskScore}/100
                    </Badge>
                  ) : !row.isBreakGlass ? (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Pending</span>
                  ) : null}
                  {row.isBreakGlass && (
                    <Badge color="warning" variant="solid" size="sm">
                      Break-glass
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-4 py-4 align-top text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                {formatRequestTime(row.requestedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ActiveGrantsList({
  grants,
  now,
  showHolder = false,
}: {
  grants: ActiveGrantRow[];
  now: number;
  showHolder?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {grants.map((grant) => (
        <li
          key={grant.grantId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10"
        >
          <div>
            <Link
              href={`/requests/${grant.requestId}`}
              className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              {grant.publicId}
            </Link>
            {showHolder && (
              <p className="text-sm text-gray-600 dark:text-gray-300">{grant.holderName}</p>
            )}
          </div>
          <span className="text-sm font-medium text-warning-600 dark:text-orange-400">
            {minutesLeft(grant.expiresAt, now)} min left
          </span>
        </li>
      ))}
    </ul>
  );
}

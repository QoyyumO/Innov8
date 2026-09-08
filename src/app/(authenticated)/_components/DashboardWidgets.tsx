"use client";

import { ReactNode } from "react";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DummyRequest, AccessDecision } from "./dashboardDummy";

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

export function DecisionBadge({ decision }: { decision: AccessDecision }) {
  const color =
    decision === "ALLOW" ? "success" : decision === "VERIFY" ? "warning" : "error";

  return (
    <Badge color={color} size="sm">
      {decision}
    </Badge>
  );
}

export function RequestsTable({ requests }: { requests: DummyRequest[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800">
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Patient
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Purpose
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Source
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Decision
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Risk
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Time
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {requests.map((request) => (
            <TableRow
              key={request.id}
              className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <TableCell className="px-4 py-4">
                <div className="font-medium text-gray-800 dark:text-white/90">
                  {request.patientId}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {request.patientName}
                </div>
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                <div>{request.purpose}</div>
                <div className="text-xs text-gray-500">{request.recordTypes}</div>
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                {request.facility}
              </TableCell>
              <TableCell className="px-4 py-4">
                <DecisionBadge decision={request.decision} />
              </TableCell>
              <TableCell className="px-4 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                {request.risk}/100
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-gray-500">
                {request.time}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

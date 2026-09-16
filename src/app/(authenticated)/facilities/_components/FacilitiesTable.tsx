"use client";

import { FunctionReturnType } from "convex/server";
import { api } from "@/lib/convex";
import Badge from "@/components/ui/badge/Badge";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GroupIcon } from "@/icons";
import type { FacilityStatus } from "../../../../../convex/lib/domain";

type Facility = FunctionReturnType<typeof api.dashboards.listFacilities>[number];

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

const STATUS_LABELS: Record<FacilityStatus, string> = {
  active: "Connected",
  pilot: "Pilot",
};

const STATUS_BADGE_COLORS: Record<FacilityStatus, "success" | "warning"> = {
  active: "success",
  pilot: "warning",
};

export function FacilitiesTable({ facilities }: { facilities: Facility[] | undefined }) {
  if (facilities === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loading />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <EmptyState
        title="No facilities yet"
        description="Run the facilities seed to add FMC Lagos, FMC Abuja, and FMC Abeokuta."
        icon={<GroupIcon className="h-12 w-12 text-brand-500" />}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800">
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Facility
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Code
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              City
            </TableCell>
            <TableCell isHeader className={HEADER_CELL_CLASS}>
              Exchange status
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {facilities.map((facility) => (
            <TableRow
              key={facility.facilityId}
              className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <TableCell className="px-4 py-4 font-medium text-gray-800 dark:text-white/90">
                {facility.name}
              </TableCell>
              <TableCell className="px-4 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                {facility.code}
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                {facility.city}
              </TableCell>
              <TableCell className="px-4 py-4">
                <Badge color={STATUS_BADGE_COLORS[facility.status]} size="sm">
                  {STATUS_LABELS[facility.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

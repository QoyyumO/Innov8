"use client";

import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import { FileIcon } from "@/icons";
import { DashboardRequestsTable, DashboardRow } from "./DashboardWidgets";

/** Latest risk decisions across the exchange, for security officers and admins. */
export function RecentDecisionsCard({ rows }: { rows: DashboardRow[] | undefined }) {
  return (
    <ComponentCard
      title="Latest access decisions"
      desc="Newest risk decisions across participating facilities. Clinical contents are never shown here."
    >
      {rows && rows.length > 0 ? (
        <DashboardRequestsTable rows={rows} showRequester />
      ) : (
        <EmptyState
          title={rows === undefined ? "Loading decisions…" : "No decisions yet"}
          description="Decisions appear as soon as clinicians request access."
          icon={<FileIcon className="h-12 w-12 text-brand-500" />}
        />
      )}
    </ComponentCard>
  );
}

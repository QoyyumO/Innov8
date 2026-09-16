"use client";

import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import { FileIcon } from "@/icons";
import { DashboardRequestsTable, DashboardRow } from "./DashboardWidgets";

/**
 * Latest risk decisions, for security officers and admins. `scopeLabel` names
 * the facility when the viewer is a hospital admin (INN-52).
 */
export function RecentDecisionsCard({
  rows,
  scopeLabel,
}: {
  rows: DashboardRow[] | undefined;
  scopeLabel?: string;
}) {
  return (
    <ComponentCard
      title="Latest access decisions"
      desc={
        scopeLabel
          ? `Newest risk decisions on requests to or from ${scopeLabel}. Clinical contents are never shown here.`
          : "Newest risk decisions across participating facilities. Clinical contents are never shown here."
      }
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

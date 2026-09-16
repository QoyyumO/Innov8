"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Loading from "@/components/loading/Loading";
import { useAuth } from "@/hooks/useAuth";
import { hasFacilityReviewScope, isAdmin, isSecurityOfficer } from "@/services/permissions";
import { AuditEventsTable } from "./_components/AuditEventsTable";

function AuditTrailContent({ canReviewAll }: { canReviewAll: boolean }) {
  const searchParams = useSearchParams();
  const actorId = canReviewAll ? (searchParams.get("actorId") ?? undefined) : undefined;
  return <AuditEventsTable canFilterByActor={canReviewAll} actorId={actorId} />;
}

export default function AuditTrailPage() {
  const { user } = useAuth();
  const canReviewAll =
    user !== null && (isSecurityOfficer(user.roles) || isAdmin(user.roles));
  const isFacilityScoped = user !== null && hasFacilityReviewScope(user.roles);

  return (
    <div>
      <PageBreadCrumb pageTitle="Audit trail" />
      <ComponentCard
        title="Audit trail"
        desc={
          isFacilityScoped
            ? `Activity involving ${user?.hospital ?? "your facility"}: your staff's actions, and every request, decision, record view, break-glass event, and alert to or from your facility. Newest first; select a person to see only their activity. Entries cannot be edited or deleted.`
            : canReviewAll
              ? "Every sign-in, search, request, decision, record view, break-glass event, and alert across the exchange, newest first. Select a person to see only their activity. Entries cannot be edited or deleted."
              : "Everything you have done on the exchange, newest first: sign-ins, searches, requests, decisions, record views, and break-glass. Entries cannot be edited or deleted."
        }
      >
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loading />
            </div>
          }
        >
          <AuditTrailContent canReviewAll={canReviewAll} />
        </Suspense>
      </ComponentCard>
    </div>
  );
}

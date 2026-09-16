"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { FileIcon } from "@/icons";
import { DecisionResult } from "../_components/DecisionResult";

export default function AccessRequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";
  const { sessionToken } = useAuth();
  const request = useQuery(
    api.accessRequests.getAccessRequest,
    sessionToken && requestId !== "" ? { token: sessionToken, requestId } : "skip",
  );

  const isLoading = sessionToken !== null && requestId !== "" && request === undefined;

  return (
    <div>
      <PageBreadCrumb
        items={[
          { name: "Access requests", href: "/requests" },
          { name: request ? `Request for ${request.publicId}` : "Request" },
        ]}
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loading />
        </div>
      )}

      {!isLoading && !request && (
        <EmptyState
          title="Request not found"
          description="It may not exist, or it belongs to another clinician."
          icon={<FileIcon className="h-12 w-12 text-brand-500" />}
        />
      )}

      {!isLoading && request && (
        <div className="space-y-6">
          <ComponentCard
            title="Access decision"
            desc={`${request.sourceFacility.name} → ${request.targetFacility.name}`}
          >
            {request.decision ? (
              <DecisionResult
                publicId={request.publicId}
                targetFacilityName={request.targetFacility.name}
                purpose={request.purpose}
                recordTypes={request.recordTypes}
                recordCount={request.recordCount}
                requestedAt={request.requestedAt}
                outcome={request.decision.outcome}
                riskScore={request.decision.riskScore}
                reasons={request.decision.reasons}
                factors={request.decision.factors}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No decision has been recorded for this request.
              </p>
            )}
          </ComponentCard>

          <Link
            href={`/patients/${encodeURIComponent(request.publicId)}`}
            className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Back to {request.publicId}
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { FileIcon } from "@/icons";
import { isGrantLive } from "../../_components/emergencyLabels";
import { DecisionResult } from "../_components/DecisionResult";
import { AuthorisedSummary } from "../_components/AuthorisedSummary";
import { ClinicalNotePanel } from "../_components/ClinicalNotePanel";
import { EmergencyGrantCard } from "../_components/EmergencyGrantCard";

export default function AccessRequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";
  const { sessionToken } = useAuth();
  const now = useNow();
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
                verifiedAt={request.decision.verifiedAt}
                escalatedAt={request.decision.escalatedAt}
              />
            ) : request.emergency ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Break-glass request for {request.publicId} ({request.purpose}). No risk
                decision was made; the emergency grant below governs access.
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No decision has been recorded for this request.
              </p>
            )}
          </ComponentCard>

          {request.emergency && (
            <ComponentCard
              title="Emergency access"
              desc="Temporary, justified, and audited."
            >
              <EmergencyGrantCard grant={request.emergency} canRevoke />
            </ComponentCard>
          )}

          {request.isOwnRequest && (
            <ComponentCard
              title="Authorised records"
              desc={`Held at ${request.targetFacility.name}`}
            >
              <AuthorisedSummary
                key={request.requestId}
                requestId={request.requestId}
                publicId={request.publicId}
                outcome={request.decision?.outcome ?? null}
                canUseBreakGlass={
                  request.recordCount === 1 &&
                  request.decision !== null &&
                  request.decision.outcome !== "ALLOW" &&
                  !(request.emergency !== null && isGrantLive(request.emergency, now))
                }
                hasEmergencyGrant={
                  request.emergency !== null && isGrantLive(request.emergency, now)
                }
                allowedUntil={request.decision?.allowedUntil}
                stepUpAttemptsLeft={
                  request.recordCount === 1 ? request.decision?.stepUpAttemptsLeft : undefined
                }
                isMissingConsent={request.decision?.factors?.consent === "missing"}
              />
            </ComponentCard>
          )}

          {request.canAppendClinicalNote && (
            <ComponentCard
              title="Append clinical note"
              desc="Audited write after ALLOW. Not a full chart editor."
            >
              <ClinicalNotePanel
                requestId={request.requestId}
                originatingFacility={request.sourceFacility.name}
              />
            </ComponentCard>
          )}

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

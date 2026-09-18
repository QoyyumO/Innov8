"use client";

import { useState } from "react";
import Link from "next/link";
import { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { toUserFacingError } from "@/lib/userFacingError";
import { StepUpVerification } from "./StepUpVerification";
import type { DecisionOutcome, RecordType } from "../../../../../convex/lib/domain";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import {
  RECORD_TYPE_LABELS,
  formatRequestTime,
} from "../../_components/accessLabels";

type ViewResult = FunctionReturnType<typeof api.records.viewAuthorisedSummary>;
type Sections = Extract<NonNullable<ViewResult>, { status: "authorised" }>["sections"];

type AuthorisedSummaryProps = {
  requestId: string;
  publicId: string;
  outcome: DecisionOutcome | null;
  /** Own, single-patient, BLOCK or VERIFY request without a live grant. */
  canUseBreakGlass: boolean;
  hasEmergencyGrant: boolean;
  /** ALLOW only: when the decision stops releasing records (INN-51). */
  allowedUntil?: number;
  /** VERIFY only, own single-patient request: step-up attempts left (INN-44). */
  stepUpAttemptsLeft?: number;
  /** INN-45: the request was challenged because patient consent was missing. */
  isMissingConsent?: boolean;
};

function RequestAgainLink({ publicId }: { publicId: string }) {
  return (
    <Link
      href={`/requests/new?publicId=${encodeURIComponent(publicId)}`}
      className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
    >
      Request access again
    </Link>
  );
}

function BreakGlassLink({ requestId, publicId }: { requestId: string; publicId: string }) {
  return (
    <Link
      href={`/emergency?publicId=${encodeURIComponent(publicId)}&requestId=${encodeURIComponent(requestId)}`}
      className="inline-block text-sm font-medium text-warning-600 hover:text-warning-700 dark:text-orange-400"
    >
      Emergency? Use break-glass for this request
    </Link>
  );
}

function SectionList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">None recorded.</p>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
      {items.map((item, itemIndex) => (
        <li key={`${itemIndex}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function renderSection(recordType: RecordType, sections: Sections) {
  if (recordType === "medical_summary") {
    return (
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {sections.medicalSummary ?? "None recorded."}
      </p>
    );
  }
  if (recordType === "allergies") {
    return <SectionList items={sections.allergies ?? []} />;
  }
  if (recordType === "medications") {
    return <SectionList items={sections.medications ?? []} />;
  }
  if (recordType === "diagnoses") {
    return <SectionList items={sections.diagnoses ?? []} />;
  }
  if (recordType === "lab_results") {
    return <SectionList items={sections.labResults ?? []} />;
  }
  return <SectionList items={[]} />;
}

/**
 * Demo step 5. Clinical content is fetched only when the requester presses
 * the button, because each view is written to the audit trail.
 */
export function AuthorisedSummary({
  requestId,
  publicId,
  outcome,
  canUseBreakGlass,
  hasEmergencyGrant,
  allowedUntil,
  stepUpAttemptsLeft,
  isMissingConsent = false,
}: AuthorisedSummaryProps) {
  const { sessionToken } = useAuth();
  const now = useNow();
  const isAllowExpired =
    outcome === "ALLOW" &&
    !hasEmergencyGrant &&
    allowedUntil !== undefined &&
    allowedUntil <= now;
  const viewAuthorisedSummary = useMutation(api.records.viewAuthorisedSummary);
  const [result, setResult] = useState<ViewResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleView = async () => {
    setErrorMessage(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    setIsLoading(true);
    try {
      setResult(await viewAuthorisedSummary({ token: sessionToken, requestId }));
    } catch (error) {
      console.error("Error viewing authorised summary:", error);
      setErrorMessage(toUserFacingError(error, "Records could not be loaded. Try again."));
    } finally {
      setIsLoading(false);
    }
  };

  if (result === undefined && isAllowExpired) {
    return (
      <div className="space-y-3">
        <Alert
          variant="warning"
          title="Allowed access has expired"
          message={`Access to ${publicId} ended ${formatRequestTime(allowedUntil)}. Request access again to open the records.`}
        />
        <RequestAgainLink publicId={publicId} />
      </div>
    );
  }

  if (result === undefined && outcome === "VERIFY" && stepUpAttemptsLeft !== undefined) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This request was challenged. Re-enter your password to release the requested
          sections; nothing is shown until you do.
        </p>
        {isMissingConsent && (
          <Alert
            variant="warning"
            title="Patient consent needed first"
            message={`${publicId} has no active consent for your facility. Record the patient's consent, then complete verification.`}
          />
        )}
        {isMissingConsent && (
          <Link
            href={`/patients/${encodeURIComponent(publicId)}`}
            className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Record consent on the patient page
          </Link>
        )}
        <StepUpVerification
          requestId={requestId}
          publicId={publicId}
          attemptsLeft={stepUpAttemptsLeft}
        />
        {canUseBreakGlass && <BreakGlassLink requestId={requestId} publicId={publicId} />}
      </div>
    );
  }

  if (result === undefined) {
    return (
      <div className="space-y-4">
        {errorMessage && (
          <Alert variant="error" title="Records not loaded" message={errorMessage} />
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {hasEmergencyGrant
            ? "Break-glass access covers this request while the grant is active. Opening the records releases only the sections on the request and records the view in the audit trail."
            : outcome === "ALLOW"
              ? `Access was allowed${
                  allowedUntil !== undefined ? ` until ${formatRequestTime(allowedUntil)}` : ""
                }. Opening the records releases only the sections you requested, from the facility that holds them, and records the view in the audit trail.`
              : "Access was not allowed. No clinical content is released unless an active emergency grant covers this request."}
        </p>
        <Button onClick={handleView} disabled={isLoading || !sessionToken}>
          {isLoading ? "Opening…" : "View authorised records"}
        </Button>
        {canUseBreakGlass && <BreakGlassLink requestId={requestId} publicId={publicId} />}
      </div>
    );
  }

  if (result === null) {
    return (
      <Alert
        variant="error"
        title="Not available"
        message="Only the clinician who made this request can open its records."
      />
    );
  }

  if (result.status === "denied" && result.expiredAt !== undefined) {
    return (
      <div className="space-y-3">
        <Alert
          variant="warning"
          title="Allowed access has expired"
          message={`Access to ${publicId} ended ${formatRequestTime(result.expiredAt)}. No clinical content was released, and the attempt was recorded in the audit trail.`}
        />
        <RequestAgainLink publicId={publicId} />
      </div>
    );
  }

  if (result.status === "denied") {
    return (
      <div className="space-y-3">
        <Alert
          variant="error"
          title="No clinical content released"
          message={
            hasEmergencyGrant
              ? "Emergency access for this request has ended. Records stay with the holding facility."
              : `This request is ${result.outcome ?? "undecided"}${
                  result.riskScore !== null ? ` (risk ${result.riskScore}/100)` : ""
                }. Records stay with the holding facility.`
          }
        />
        {canUseBreakGlass && <BreakGlassLink requestId={requestId} publicId={publicId} />}
      </div>
    );
  }

  if (result.status === "unavailable") {
    return (
      <Alert
        variant="warning"
        title="No summary on file"
        message={`${result.facility.name} has no clinical summary for ${result.publicId} yet.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      {result.grantedBy === "emergency" && result.emergencyExpiresAt !== undefined && (
        <Alert
          variant="warning"
          title="Emergency access"
          message={`Break-glass access ends ${formatRequestTime(result.emergencyExpiresAt)}. This view is audited and reviewed by security.`}
        />
      )}

      {result.allowedUntil !== undefined && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Allowed until {formatRequestTime(result.allowedUntil)}. After that, request access again.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge color="info" size="sm">
          Holding facility: {result.facility.name}
        </Badge>
        <Badge color="light" size="sm">
          {result.publicId}
        </Badge>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Summary updated {formatRequestTime(result.summaryUpdatedAt)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {result.recordTypes.map((recordType) => (
          <section
            key={recordType}
            className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
          >
            <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">
              {RECORD_TYPE_LABELS[recordType]}
            </h4>
            {renderSection(recordType, result.sections)}
          </section>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Only the sections on this request are shown. This view has been recorded in the
        audit trail.
      </p>
    </div>
  );
}

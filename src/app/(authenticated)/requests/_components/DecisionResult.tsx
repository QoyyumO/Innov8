import { ReactNode } from "react";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import type {
  ConsentCheck,
  DecisionOutcome,
  Purpose,
  RecordType,
} from "../../../../../convex/lib/domain";
import {
  OUTCOME_ALERT_VARIANTS,
  OUTCOME_BADGE_COLORS,
  OUTCOME_LABELS,
  PURPOSE_LABELS,
  RECORD_TYPE_LABELS,
  formatRequestTime,
  formatRole,
} from "../../_components/accessLabels";

export type DecisionResultProps = {
  publicId: string;
  targetFacilityName: string;
  purpose: Purpose;
  recordTypes: RecordType[];
  recordCount: number;
  requestedAt: number;
  outcome: DecisionOutcome;
  riskScore: number;
  reasons: string[];
  factors?: {
    role: string;
    sameHospital: boolean;
    consent?: ConsentCheck;
  };
  /** Step-up (INN-44): when a VERIFY decision was completed or escalated. */
  verifiedAt?: number;
  escalatedAt?: number;
  /** Shown under the headline, e.g. the "Complete verification" button. */
  action?: ReactNode;
};

const OUTCOME_MESSAGES: Record<DecisionOutcome, string> = {
  ALLOW:
    "Access is granted for the record types you asked for. Only those sections will be released.",
  VERIFY:
    "This request needs step-up verification: re-enter your password to continue. No records are released until then.",
  BLOCK:
    "This request was blocked. No records are released and the attempt is recorded in the audit trail.",
};

const SCORE_TEXT_COLORS: Record<DecisionOutcome, string> = {
  ALLOW: "text-success-600 dark:text-success-500",
  VERIFY: "text-warning-600 dark:text-orange-400",
  BLOCK: "text-error-600 dark:text-error-500",
};

export function DecisionResult({
  publicId,
  targetFacilityName,
  purpose,
  recordTypes,
  recordCount,
  requestedAt,
  outcome,
  riskScore,
  reasons,
  factors,
  verifiedAt,
  escalatedAt,
  action,
}: DecisionResultProps) {
  return (
    <div className="space-y-6">
      <Alert
        variant={OUTCOME_ALERT_VARIANTS[outcome]}
        title={`${OUTCOME_LABELS[outcome]} — ${publicId} at ${targetFacilityName}`}
        message={OUTCOME_MESSAGES[outcome]}
      />

      {verifiedAt !== undefined && (
        <p className="text-sm font-medium text-success-600 dark:text-success-500">
          Verified by password {formatRequestTime(verifiedAt)} (was VERIFY)
        </p>
      )}
      {escalatedAt !== undefined && (
        <p className="text-sm font-medium text-error-600 dark:text-error-500">
          Blocked {formatRequestTime(escalatedAt)} after repeated failed verification (was VERIFY)
        </p>
      )}
      {action}

      <div className="grid gap-6 md:grid-cols-[minmax(0,12rem)_1fr]">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Risk score
          </p>
          <p className={`mt-2 text-4xl font-semibold ${SCORE_TEXT_COLORS[outcome]}`}>
            {riskScore}
            <span className="text-lg font-normal text-gray-400">/100</span>
          </p>
          <div className="mt-3">
            <Badge color={OUTCOME_BADGE_COLORS[outcome]} variant="solid" size="sm">
              {outcome}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Why this decision
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Decision factors">
        <Badge color="light" size="sm">
          Purpose: {PURPOSE_LABELS[purpose]}
        </Badge>
        {factors && (
          <>
            <Badge color="light" size="sm">
              Role: {formatRole(factors.role)}
            </Badge>
            <Badge color={factors.sameHospital ? "light" : "info"} size="sm">
              {factors.sameHospital ? "Same facility" : "Cross-facility"}
            </Badge>
            {factors.consent === "active" && (
              <Badge color="success" size="sm">
                Consent on file
              </Badge>
            )}
            {factors.consent === "missing" && (
              <Badge color="warning" size="sm">
                No patient consent
              </Badge>
            )}
          </>
        )}
        <Badge color={recordCount > 1 ? "warning" : "light"} size="sm">
          {recordCount === 1 ? "1 patient record" : `${recordCount} patient records`}
        </Badge>
        {recordTypes.map((recordType) => (
          <Badge key={recordType} color="primary" size="sm">
            {RECORD_TYPE_LABELS[recordType]}
          </Badge>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Requested {formatRequestTime(requestedAt)} (West Africa Time)
      </p>
    </div>
  );
}

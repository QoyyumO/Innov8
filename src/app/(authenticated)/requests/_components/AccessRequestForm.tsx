"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Radio from "@/components/form/input/Radio";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { toUserFacingError } from "@/lib/userFacingError";
import type { Purpose, RecordType } from "../../../../../convex/lib/domain";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../../convex/lib/demoIds";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import {
  OUTCOME_ALERT_VARIANTS,
  OUTCOME_LABELS,
  PURPOSE_OPTIONS,
  RECORD_TYPE_LABELS,
} from "../../_components/accessLabels";
import {
  allowedRecordTypesForRoles,
  nextUncheckedRecordTypes,
} from "../../../../../convex/lib/recordTypeAccess";
import { DecisionResult } from "./DecisionResult";
import { StepUpVerification } from "./StepUpVerification";

type CreateAccessRequestResult = FunctionReturnType<
  typeof api.accessRequests.createAccessRequest
>;

function toRequestError(error: unknown): string {
  return toUserFacingError(error, "The request could not be submitted. Try again.");
}

type AccessRequestFormProps = {
  initialPublicId?: string;
};

export function AccessRequestForm({ initialPublicId = "" }: AccessRequestFormProps) {
  const router = useRouter();
  const { sessionToken, user } = useAuth();
  const createAccessRequest = useMutation(api.accessRequests.createAccessRequest);
  const allowedRecordTypes = useMemo(
    () => allowedRecordTypesForRoles(user?.roles ?? []),
    [user?.roles],
  );
  const [publicId, setPublicId] = useState(initialPublicId);
  const [purpose, setPurpose] = useState<Purpose>("treatment");
  const [uncheckedRecordTypes, setUncheckedRecordTypes] = useState<RecordType[]>([]);
  const recordTypes = allowedRecordTypes.filter(
    (recordType) => !uncheckedRecordTypes.includes(recordType),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAccessRequestResult | null>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result) {
      return;
    }
    resultRegionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultRegionRef.current?.focus();
  }, [result]);

  const toggleRecordType = (recordType: RecordType, isChecked: boolean) => {
    setUncheckedRecordTypes((current) =>
      nextUncheckedRecordTypes(current, recordType, isChecked),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);

    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    const trimmedPublicId = publicId.trim();
    if (trimmedPublicId === "") {
      setErrorMessage("Enter the patient's public ID.");
      return;
    }
    if (recordTypes.length === 0) {
      setErrorMessage("Choose at least one record type.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createAccessRequest({
        token: sessionToken,
        publicId: trimmedPublicId,
        purpose,
        recordTypes,
      });
      setResult(created);
    } catch (error) {
      console.error("Error creating access request:", error);
      setErrorMessage(toRequestError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <Alert variant="error" title="Request not submitted" message={errorMessage} />
        )}

        <div>
          <Label htmlFor="request-public-id">Patient public ID</Label>
          <Input
            id="request-public-id"
            name="publicId"
            type="text"
            value={publicId}
            onChange={(event) => setPublicId(event.target.value)}
            placeholder={DEMO_PATIENT_PUBLIC_ID}
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-400">
            Purpose
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PURPOSE_OPTIONS.map((option) => (
              <div key={option.value}>
                <Radio
                  id={`purpose-${option.value}`}
                  name="purpose"
                  value={option.value}
                  label={option.label}
                  checked={purpose === option.value}
                  onChange={(value) => setPurpose(value as Purpose)}
                  disabled={isSubmitting}
                />
                <p className="mt-1 pl-8 text-xs text-gray-500 dark:text-gray-400">
                  {option.hint}
                </p>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-400">
            Record types
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {allowedRecordTypes.map((recordType) => (
              <Checkbox
                key={recordType}
                id={`record-type-${recordType}`}
                label={RECORD_TYPE_LABELS[recordType]}
                checked={recordTypes.includes(recordType)}
                onChange={(isChecked) => toggleRecordType(recordType, isChecked)}
                disabled={isSubmitting}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Ask only for what you need, and only what your role may request. Only these
            sections are released if access is allowed.
          </p>
        </fieldset>

        <Button type="submit" disabled={isSubmitting || !sessionToken}>
          {isSubmitting ? "Evaluating…" : "Submit request"}
        </Button>
        <div aria-live="polite">
          {result && (
            <Alert
              variant={OUTCOME_ALERT_VARIANTS[result.outcome]}
              title={`${OUTCOME_LABELS[result.outcome]} — ${result.riskScore}/100`}
              message="Full reasons are in the decision below."
            />
          )}
        </div>
      </form>

      {result && (
        <div
          ref={resultRegionRef}
          tabIndex={-1}
          className="space-y-4 border-t border-gray-100 pt-6 outline-none dark:border-gray-800"
        >
          <DecisionResult
            publicId={result.publicId}
            targetFacilityName={result.targetFacility.name}
            purpose={result.purpose}
            recordTypes={result.recordTypes}
            recordCount={result.recordCount}
            requestedAt={result.requestedAt}
            outcome={result.outcome}
            riskScore={result.riskScore}
            reasons={result.reasons}
            factors={result.factors}
            action={
              result.outcome === "VERIFY" && result.recordCount === 1 ? (
                <StepUpVerification
                  key={result.requestId}
                  requestId={result.requestId}
                  publicId={result.publicId}
                  autoOpen
                  onVerified={() => router.push(`/requests/${result.requestId}`)}
                />
              ) : undefined
            }
          />
          <Link
            href={`/requests/${result.requestId}`}
            className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            {result.outcome === "ALLOW"
              ? "Open request to view authorised records"
              : "Open saved request"}
          </Link>
        </div>
      )}
    </div>
  );
}

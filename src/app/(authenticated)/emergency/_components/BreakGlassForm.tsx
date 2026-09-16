"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import { toUserFacingError } from "@/lib/userFacingError";
import type { RecordType } from "../../../../../convex/lib/domain";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import { findAccessRequestInputError } from "../../../../../convex/lib/accessRequestMessages";
import {
  EMERGENCY_ACCESS_TTL_MS,
  JUSTIFICATION_MAX_LENGTH,
  JUSTIFICATION_MIN_LENGTH,
  findEmergencyInputError,
} from "../../../../../convex/lib/emergencyConstants";
import {
  RECORD_TYPES,
  RECORD_TYPE_LABELS,
} from "../../_components/accessLabels";
import { describeGrantStatus, isGrantLive } from "../../_components/emergencyLabels";

type GrantResult = FunctionReturnType<typeof api.emergency.grantEmergencyAccess>;

const TTL_MINUTES = Math.round(EMERGENCY_ACCESS_TTL_MS / 60_000);

function toGrantError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return (
    findEmergencyInputError(message) ??
    findAccessRequestInputError(message) ??
    toUserFacingError(error, "Emergency access could not be granted. Try again.")
  );
}

type BreakGlassFormProps = {
  initialPublicId: string;
  /** Link the grant to this blocked or challenged request. */
  requestId?: string;
};

export function BreakGlassForm({ initialPublicId, requestId }: BreakGlassFormProps) {
  const { sessionToken } = useAuth();
  const now = useNow();
  const grantEmergencyAccess = useMutation(api.emergency.grantEmergencyAccess);
  const [publicId, setPublicId] = useState(initialPublicId);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([...RECORD_TYPES]);
  const [justification, setJustification] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResult | null>(null);

  const trimmedPublicId = publicId.trim();
  const activeGrantResult = useQuery(
    api.emergency.getActiveEmergencyAccess,
    sessionToken && trimmedPublicId !== ""
      ? { token: sessionToken, publicId: trimmedPublicId }
      : "skip",
  );
  // Queries do not re-run when time passes, so hide a grant that has since expired.
  const activeGrant =
    activeGrantResult && isGrantLive(activeGrantResult, now) ? activeGrantResult : null;
  const isLinked = requestId !== undefined;
  const trimmedJustification = justification.trim();

  const toggleRecordType = (recordType: RecordType, isChecked: boolean) => {
    setRecordTypes((current) =>
      isChecked
        ? RECORD_TYPES.filter(
            (candidate) => candidate === recordType || current.includes(candidate),
          )
        : current.filter((candidate) => candidate !== recordType),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (trimmedPublicId === "") {
      setErrorMessage("Enter the patient's public ID.");
      return;
    }
    if (!isLinked && recordTypes.length === 0) {
      setErrorMessage("Choose at least one record type.");
      return;
    }
    if (trimmedJustification.length < JUSTIFICATION_MIN_LENGTH) {
      setErrorMessage(
        `Explain the emergency in at least ${JUSTIFICATION_MIN_LENGTH} characters.`,
      );
      return;
    }
    if (!isConfirmed) {
      setErrorMessage("Confirm that this is a genuine emergency.");
      return;
    }

    setIsSubmitting(true);
    try {
      setResult(
        await grantEmergencyAccess({
          token: sessionToken,
          publicId: trimmedPublicId,
          justification: trimmedJustification,
          recordTypes,
          requestId,
        }),
      );
    } catch (error) {
      console.error("Error granting emergency access:", error);
      setErrorMessage(toGrantError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Alert
          variant="warning"
          title={`Emergency access granted for ${result.publicId}`}
          message={`${describeGrantStatus(result, now)}. Security has been notified and every view is audited.`}
        />
        <div className="flex flex-wrap gap-2">
          <Badge color="info" size="sm">
            Source: {result.targetFacility.name}
          </Badge>
          {result.recordTypes.map((recordType) => (
            <Badge key={recordType} color="primary" size="sm">
              {RECORD_TYPE_LABELS[recordType]}
            </Badge>
          ))}
        </div>
        {isGrantLive(result, now) && (
          <Link
            href={`/requests/${result.requestId}`}
            className="inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Open emergency records
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert
        variant="warning"
        title="Break-glass is temporary and audited"
        message={`Use this only when normal access cannot be completed in time. Access lasts ${TTL_MINUTES} minutes, your justification is sent to security, and every view is recorded.`}
      />

      {errorMessage && (
        <Alert variant="error" title="Emergency access not granted" message={errorMessage} />
      )}

      {activeGrant && (
        <Alert
          variant="info"
          title="You already have emergency access to this patient"
          message={describeGrantStatus(activeGrant, now)}
          showLink
          linkHref={`/requests/${activeGrant.requestId}`}
          linkText="Open emergency records"
        />
      )}

      <div>
        <Label htmlFor="break-glass-public-id">Patient public ID</Label>
        <Input
          id="break-glass-public-id"
          name="publicId"
          type="text"
          value={publicId}
          onChange={(event) => setPublicId(event.target.value)}
          autoComplete="off"
          disabled={isSubmitting || isLinked}
        />
        {isLinked && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Linked to your earlier request; its record types apply.
          </p>
        )}
      </div>

      {!isLinked && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-400">
            Record types
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {RECORD_TYPES.map((recordType) => (
              <Checkbox
                key={recordType}
                id={`break-glass-type-${recordType}`}
                label={RECORD_TYPE_LABELS[recordType]}
                checked={recordTypes.includes(recordType)}
                onChange={(isChecked) => toggleRecordType(recordType, isChecked)}
                disabled={isSubmitting}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <Label htmlFor="break-glass-justification">Justification</Label>
        <TextArea
          id="break-glass-justification"
          name="justification"
          rows={4}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="What is the emergency, and why can't normal access wait?"
          disabled={isSubmitting}
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {trimmedJustification.length}/{JUSTIFICATION_MAX_LENGTH} characters · at least{" "}
          {JUSTIFICATION_MIN_LENGTH}
        </p>
      </div>

      <Checkbox
        id="break-glass-confirm"
        label="I confirm this is a genuine clinical emergency"
        checked={isConfirmed}
        onChange={setIsConfirmed}
        disabled={isSubmitting}
      />

      <Button
        type="submit"
        variant="warning"
        disabled={isSubmitting || !sessionToken || Boolean(activeGrant)}
      >
        {isSubmitting ? "Granting…" : `Use break-glass (${TTL_MINUTES} minutes)`}
      </Button>
    </form>
  );
}

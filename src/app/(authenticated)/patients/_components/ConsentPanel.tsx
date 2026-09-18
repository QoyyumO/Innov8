"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import Checkbox from "@/components/form/input/Checkbox";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Loading from "@/components/loading/Loading";
import { toUserFacingError } from "@/lib/userFacingError";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import {
  CONSENT_DURATION_MS,
  CONSENT_NOTE_MAX_LENGTH,
  CONSENT_NOTE_MIN_LENGTH,
} from "../../../../../convex/lib/consentConstants";
import { formatRequestTime } from "../../_components/accessLabels";

const CONSENT_DAYS = Math.round(CONSENT_DURATION_MS / (24 * 60 * 60 * 1000));

/**
 * INN-45: whether the viewer's facility has the patient's consent, and a form
 * to record it. Consent is only needed when the records are held elsewhere.
 */
export function ConsentPanel({ publicId }: { publicId: string }) {
  const { sessionToken } = useAuth();
  const status = useQuery(
    api.consents.getConsentStatus,
    sessionToken ? { token: sessionToken, publicId } : "skip",
  );
  const recordPatientConsent = useMutation(api.consents.recordPatientConsent);
  const [note, setNote] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === undefined) {
    return (
      <div className="flex justify-center py-6">
        <Loading />
      </div>
    );
  }

  if (status === null) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Consent status is not available for this patient.
      </p>
    );
  }

  if (!status.isRequired) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="light" size="sm">
          Not needed
        </Badge>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          These records are held at {status.facility}, your own facility.
        </p>
      </div>
    );
  }

  if (status.consent) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="success" size="sm">
            Consent active
          </Badge>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {status.facility} may request records held at {status.patientFacility} until{" "}
            {formatRequestTime(status.consent.expiresAt)}.
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Recorded {formatRequestTime(status.consent.grantedAt)}
          {status.consent.recordedBy ? ` by ${status.consent.recordedBy}` : ""}:{" "}
          “{status.consent.note}”
        </p>
      </div>
    );
  }

  const trimmedNote = note.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (trimmedNote.length < CONSENT_NOTE_MIN_LENGTH) {
      setErrorMessage(
        `Describe how consent was given in at least ${CONSENT_NOTE_MIN_LENGTH} characters.`,
      );
      return;
    }
    if (!isConfirmed) {
      setErrorMessage("Confirm that the patient gave consent.");
      return;
    }
    setIsSubmitting(true);
    try {
      await recordPatientConsent({ token: sessionToken, publicId, note: trimmedNote });
      setNote("");
      setIsConfirmed(false);
    } catch (error) {
      console.error("Error recording consent:", error);
      setErrorMessage(
        toUserFacingError(error, "Consent could not be recorded. Try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="warning" size="sm">
          No consent
        </Badge>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Requests from {status.facility} for records held at {status.patientFacility} will need
          verification until the patient consents. Break-glass still works in an emergency.
        </span>
      </div>

      {errorMessage && (
        <Alert variant="error" title="Consent not recorded" message={errorMessage} />
      )}

      <div>
        <Label htmlFor="consent-note">How did the patient consent?</Label>
        <TextArea
          id="consent-note"
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Patient agreed verbally at the bedside, witnessed by the charge nurse"
          disabled={isSubmitting}
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {trimmedNote.length}/{CONSENT_NOTE_MAX_LENGTH} characters · at least{" "}
          {CONSENT_NOTE_MIN_LENGTH}
        </p>
      </div>

      <Checkbox
        id="consent-confirm"
        label={`The patient consented to ${status.facility} requesting their records for ${CONSENT_DAYS} days`}
        checked={isConfirmed}
        onChange={setIsConfirmed}
        disabled={isSubmitting}
      />

      <Button type="submit" disabled={isSubmitting || !sessionToken}>
        {isSubmitting ? "Recording…" : "Record consent"}
      </Button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Recording consent is audited. Security officers and administrators can revoke it.
      </p>
    </form>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocsIcon } from "@/icons";
import { toUserFacingError } from "@/lib/userFacingError";
import { SESSION_EXPIRED_MESSAGE } from "../../../../convex/lib/authConstants";
import {
  CONSENT_DURATION_MS,
  CONSENT_NOTE_MAX_LENGTH,
  CONSENT_NOTE_MIN_LENGTH,
} from "../../../../convex/lib/consentConstants";
import { formatRequestTime } from "./accessLabels";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";
const SELECT_CLASS =
  "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";
const CONSENT_DAYS = Math.round(CONSENT_DURATION_MS / (24 * 60 * 60 * 1000));

type PatientConsentPanelProps = {
  homeFacilityCode: string;
};

/** INN-77: the signed-in patient lists, grants, and revokes their own consents. */
export function PatientConsentPanel({ homeFacilityCode }: PatientConsentPanelProps) {
  const { sessionToken } = useAuth();
  const now = useNow();
  const consents = useQuery(
    api.consents.listMyConsents,
    sessionToken ? { token: sessionToken } : "skip",
  );
  const facilities = useQuery(
    api.dashboards.listFacilities,
    sessionToken ? { token: sessionToken } : "skip",
  );
  const grantMyConsent = useMutation(api.consents.grantMyConsent);
  const revokeMyConsent = useMutation(api.consents.revokeMyConsent);
  const [facilityId, setFacilityId] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<Id<"consents"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const grantableFacilities = (facilities ?? []).filter(
    (facility) => facility.code !== homeFacilityCode,
  );
  const trimmedNote = note.trim();

  const handleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!facilityId) {
      setErrorMessage("Choose a hospital that does not already hold your records.");
      return;
    }
    if (trimmedNote.length < CONSENT_NOTE_MIN_LENGTH) {
      setErrorMessage(
        `Describe your consent in at least ${CONSENT_NOTE_MIN_LENGTH} characters.`,
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await grantMyConsent({
        token: sessionToken,
        facilityId: facilityId as Id<"facilities">,
        note: trimmedNote,
      });
      setNote("");
      setFacilityId("");
    } catch (error) {
      console.error("Error granting consent:", error);
      setErrorMessage(toUserFacingError(error, "Consent could not be recorded. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (consentId: Id<"consents">) => {
    if (!sessionToken) {
      return;
    }
    setErrorMessage(null);
    setRevokingId(consentId);
    try {
      await revokeMyConsent({ token: sessionToken, consentId });
    } catch (error) {
      console.error("Error revoking consent:", error);
      setErrorMessage(toUserFacingError(error, "Consent could not be revoked. Try again."));
    } finally {
      setRevokingId(null);
    }
  };

  if (consents === undefined || facilities === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant="error" title="Consent could not be updated" message={errorMessage} />
      )}

      <form onSubmit={handleGrant} className="space-y-4">
        <div>
          <Label htmlFor="patient-consent-facility">Hospital that may request your records</Label>
          <select
            id="patient-consent-facility"
            value={facilityId}
            onChange={(event) => setFacilityId(event.target.value)}
            disabled={isSubmitting || grantableFacilities.length === 0}
            className={SELECT_CLASS}
          >
            <option value="">Select a hospital</option>
            {grantableFacilities.map((facility) => (
              <option key={facility.facilityId} value={facility.facilityId}>
                {facility.name} ({facility.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="patient-consent-note">Your consent note</Label>
          <TextArea
            id="patient-consent-note"
            name="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. I agree that FMC Abuja may request my records for treatment"
            disabled={isSubmitting}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {trimmedNote.length}/{CONSENT_NOTE_MAX_LENGTH} characters · at least{" "}
            {CONSENT_NOTE_MIN_LENGTH} · lasts {CONSENT_DAYS} days
          </p>
        </div>
        <Button type="submit" disabled={isSubmitting || !sessionToken}>
          {isSubmitting ? "Saving…" : "Grant consent"}
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Break-glass emergency access does not need this consent. Granting and revoking are
          audited.
        </p>
      </form>

      {consents.length === 0 ? (
        <EmptyState
          title="No consents yet"
          description="Grant consent when another hospital needs to request your records. Seeded Chioma already has FMC Abuja after a full demo seed."
          icon={<DocsIcon className="h-12 w-12 text-brand-500" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-gray-800">
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Access for
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Recorded
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Status
                </TableCell>
                <TableCell isHeader className={HEADER_CELL_CLASS}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {consents.map((consent) => {
                const isLive = consent.isLive && consent.expiresAt > now;
                return (
                  <TableRow
                    key={consent.consentId}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                      {consent.facility}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        Records at {consent.patientFacility}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                      {formatRequestTime(consent.grantedAt)}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {consent.recordedBy ?? "You"} · “{consent.note}”
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-nowrap">
                      {consent.status === "revoked" ? (
                        <Badge color="light" size="sm">
                          Revoked{" "}
                          {consent.revokedAt !== null ? formatRequestTime(consent.revokedAt) : ""}
                        </Badge>
                      ) : isLive ? (
                        <Badge color="success" size="sm">
                          Active until {formatRequestTime(consent.expiresAt)}
                        </Badge>
                      ) : (
                        <Badge color="light" size="sm">
                          Expired {formatRequestTime(consent.expiresAt)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      {isLive && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={revokingId === consent.consentId}
                          onClick={() => handleRevoke(consent.consentId)}
                        >
                          {revokingId === consent.consentId ? "Revoking…" : "Revoke"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

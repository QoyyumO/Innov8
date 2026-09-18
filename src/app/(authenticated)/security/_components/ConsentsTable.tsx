"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
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
import { formatRequestTime } from "../../_components/accessLabels";

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

/** INN-45: newest patient consents in the reviewer's scope, with revoke. */
export function ConsentsTable() {
  const { sessionToken } = useAuth();
  const now = useNow();
  const consents = useQuery(
    api.consents.listConsents,
    sessionToken ? { token: sessionToken } : "skip",
  );
  const revokePatientConsent = useMutation(api.consents.revokePatientConsent);
  const [revokingId, setRevokingId] = useState<Id<"consents"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const revoke = async (consentId: Id<"consents">) => {
    if (!sessionToken) {
      return;
    }
    setErrorMessage(null);
    setRevokingId(consentId);
    try {
      await revokePatientConsent({ token: sessionToken, consentId });
    } catch (error) {
      console.error("Error revoking consent:", error);
      setErrorMessage(
        toUserFacingError(error, "Consent could not be revoked. Try again."),
      );
    } finally {
      setRevokingId(null);
    }
  };

  if (consents === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loading />
      </div>
    );
  }

  if (consents.length === 0) {
    return (
      <EmptyState
        title="No consents recorded"
          description="Clinicians record consent on the patient page, and patients can grant or revoke their own consent on their dashboard."
        icon={<DocsIcon className="h-12 w-12 text-brand-500" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Consent not revoked" message={errorMessage} />
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              <TableCell isHeader className={HEADER_CELL_CLASS}>
                Patient
              </TableCell>
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
                  <TableCell className="px-4 py-4 align-top">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {consent.publicId}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Records at {consent.patientFacility}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                    {consent.facility}
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                    {formatRequestTime(consent.grantedAt)}
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {consent.recordedBy ?? "Seeded"} · “{consent.note}”
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
                        onClick={() => revoke(consent.consentId)}
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
    </div>
  );
}

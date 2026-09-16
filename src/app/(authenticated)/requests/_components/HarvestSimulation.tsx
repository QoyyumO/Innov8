"use client";

import { useState } from "react";
import { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { toUserFacingError } from "@/lib/userFacingError";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../../convex/lib/demoIds";
import { HARVEST_RECORD_COUNT } from "../../../../../convex/lib/riskConstants";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import { DecisionResult } from "./DecisionResult";

type HarvestResult = FunctionReturnType<typeof api.accessRequests.simulateBulkHarvest>;

/**
 * Demo step 6: the same clinician suddenly asks for a bulk export. The
 * server fixes the volume (`simulateBulkHarvest`); the risk engine blocks it
 * and the alert service reports it to security.
 */
export function HarvestSimulation() {
  const { sessionToken } = useAuth();
  const simulateBulkHarvest = useMutation(api.accessRequests.simulateBulkHarvest);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<HarvestResult | null>(null);

  const handleSimulate = async () => {
    setErrorMessage(null);
    setResult(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    setIsSubmitting(true);
    try {
      setResult(
        await simulateBulkHarvest({
          token: sessionToken,
          publicId: DEMO_PATIENT_PUBLIC_ID,
        }),
      );
    } catch (error) {
      console.error("Error simulating bulk harvest:", error);
      setErrorMessage(
        toUserFacingError(error, "The simulation could not run. Seed the demo data and try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Sends one request covering {HARVEST_RECORD_COUNT} patient records, starting with{" "}
        {DEMO_PATIENT_PUBLIC_ID}. It should be blocked, raise a security alert, and appear in
        the audit trail. Nothing clinical is released.
      </p>
      {errorMessage && (
        <Alert variant="error" title="Simulation did not run" message={errorMessage} />
      )}
      <Button variant="danger" size="sm" onClick={handleSimulate} disabled={isSubmitting || !sessionToken}>
        {isSubmitting
          ? "Submitting…"
          : `Simulate bulk harvest (${HARVEST_RECORD_COUNT} records)`}
      </Button>
      {result && (
        <div className="space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
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
          />
          {result.outcome === "BLOCK" && (
            <Alert
              variant="warning"
              title="Security has been alerted"
              message="A high-severity alert is waiting in the security officer's queue."
            />
          )}
        </div>
      )}
    </div>
  );
}

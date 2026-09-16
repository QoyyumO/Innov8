"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { Modal } from "@/components/ui/modal";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { toUserFacingError } from "@/lib/userFacingError";
import { SESSION_EXPIRED_MESSAGE } from "../../../../../convex/lib/authConstants";
import {
  STEP_UP_MAX_FAILURES,
  findStepUpInputError,
} from "../../../../../convex/lib/stepUpConstants";
import { formatRequestTime } from "../../_components/accessLabels";

type StepUpVerificationProps = {
  requestId: string;
  publicId: string;
  /** Attempts left before the request is blocked. */
  attemptsLeft?: number;
  /** Open the dialog straight away (e.g. right after a VERIFY decision). */
  autoOpen?: boolean;
  size?: "sm" | "md";
  onVerified?: () => void;
};

type Outcome =
  | { kind: "verified"; allowedUntil: number }
  | { kind: "blocked" };

function describeAttempts(attemptsLeft: number): string {
  return attemptsLeft === 1 ? "1 attempt left" : `${attemptsLeft} attempts left`;
}

/**
 * INN-44: "Complete verification" button plus the password dialog.
 * A wrong password is counted; the last allowed failure blocks the request.
 */
export function StepUpVerification({
  requestId,
  publicId,
  attemptsLeft = STEP_UP_MAX_FAILURES,
  autoOpen = false,
  size = "md",
  onVerified,
}: StepUpVerificationProps) {
  const { sessionToken } = useAuth();
  const completeVerification = useMutation(api.stepUp.completeVerification);
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [password, setPassword] = useState("");
  const [remaining, setRemaining] = useState(attemptsLeft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const close = () => {
    setIsOpen(false);
    setPassword("");
    setErrorMessage(null);
    if (outcome?.kind === "verified") {
      onVerified?.();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!sessionToken) {
      setErrorMessage(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (password === "") {
      setErrorMessage("Enter your password to verify.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completeVerification({ token: sessionToken, requestId, password });
      setPassword("");
      if (result.status === "verified") {
        setOutcome({ kind: "verified", allowedUntil: result.allowedUntil });
      } else if (result.status === "blocked") {
        setOutcome({ kind: "blocked" });
      } else {
        setRemaining(result.attemptsLeft);
        setErrorMessage(
          `Incorrect password — ${describeAttempts(result.attemptsLeft)} before this request is blocked.`,
        );
      }
    } catch (error) {
      console.error("Error completing verification:", error);
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(
        findStepUpInputError(message) ??
          toUserFacingError(error, "Verification could not be completed. Try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button size={size} variant="warning" onClick={() => setIsOpen(true)}>
        Complete verification
      </Button>

      <Modal isOpen={isOpen} onClose={close} className="m-4 max-w-[520px]">
        <div className="relative w-full max-w-[520px] rounded-3xl bg-white p-6 lg:p-10 dark:bg-gray-900">
          <div className="pr-12">
            <h4 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
              Confirm it&apos;s you
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              This request for {publicId} was challenged. Re-enter your password to release the
              records. After {STEP_UP_MAX_FAILURES} wrong attempts the request is blocked and
              security is alerted.
            </p>
          </div>

          {outcome?.kind === "verified" && (
            <div className="space-y-4">
              <Alert
                variant="success"
                title="Verified — access allowed"
                message={`You can open the requested records until ${formatRequestTime(outcome.allowedUntil)}. This verification is in the audit trail.`}
              />
              <Button onClick={close}>Continue</Button>
            </div>
          )}

          {outcome?.kind === "blocked" && (
            <div className="space-y-4">
              <Alert
                variant="error"
                title="Request blocked"
                message="Too many wrong passwords. No records were released and security has been notified."
              />
              <Button variant="outline" onClick={close}>
                Close
              </Button>
            </div>
          )}

          {outcome === null && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <Alert variant="error" title="Not verified" message={errorMessage} />
              )}
              <div>
                <Label htmlFor={`step-up-password-${requestId}`}>Your password</Label>
                <Input
                  id={`step-up-password-${requestId}`}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {describeAttempts(remaining)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSubmitting || !sessionToken}>
                  {isSubmitting ? "Checking…" : "Verify"}
                </Button>
                <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}

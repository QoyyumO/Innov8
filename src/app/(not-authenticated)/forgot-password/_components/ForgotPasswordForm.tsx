"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { isValidEmail } from "@/lib/email";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";

export function ForgotPasswordForm() {
  const requestReset = useMutation(api.auth.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ email?: string }>(
    {},
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setApiMessage(null);
    setValidationErrors({});

    if (!email.trim()) {
      setValidationErrors({ email: "Email is required" });
      setIsLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      setValidationErrors({ email: "Please enter a valid email address" });
      setIsLoading(false);
      return;
    }

    try {
      const result = await requestReset({ email: email.toLowerCase().trim() });
      setApiMessage(
        result?.message ?? "If the account exists, reset instructions were sent.",
      );
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {apiError && <Alert variant="error" title="Error" message={apiError} />}
        {apiMessage && (
          <Alert variant="success" title="Success" message={apiMessage} />
        )}

        <div>
          <Label>
            Email <span className="text-error-500">*</span>
          </Label>
          <Input
            id="email"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (validationErrors.email) {
                setValidationErrors({});
              }
            }}
            error={!!validationErrors.email}
            disabled={isLoading}
            autoComplete="email"
          />
          {validationErrors.email && (
            <p className="text-error-500 mt-1 text-sm">
              {validationErrors.email}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading} size="full">
          {isLoading ? "Sending..." : "Send Reset Link"}
        </Button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have a token?{" "}
          <Link
            href="/reset-password"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Reset password
          </Link>
        </p>
      </div>
    </form>
  );
}

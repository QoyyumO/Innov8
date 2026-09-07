"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setApiMessage(null);
    setValidationErrors({});

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      setValidationErrors({ email: "Email is required" });
      setIsLoading(false);
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setValidationErrors({ email: "Please enter a valid email address" });
      setIsLoading(false);
      return;
    }

    try {
      const res = await requestReset({ email: email.toLowerCase().trim() });
      setApiMessage(
        res?.message ?? "If the account exists, reset instructions were sent.",
      );
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
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
            onChange={(e) => {
              setEmail(e.target.value);
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
      </div>
    </form>
  );
}

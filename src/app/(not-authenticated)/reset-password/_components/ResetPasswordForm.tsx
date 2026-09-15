"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";

const MIN_PASSWORD_LENGTH = 6;

export function ResetPasswordForm() {
  const resetPassword = useMutation(api.auth.resetPassword);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [resetToken, setResetToken] = useState(
    () => searchParams.get("token") ?? "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    resetToken?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setApiMessage(null);

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const errors: {
      email?: string;
      resetToken?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (!resetToken.trim()) {
      errors.resetToken = "Reset token is required";
    }

    if (!newPassword) {
      errors.newPassword = "Password is required";
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setIsLoading(false);
      return;
    }

    setValidationErrors({});

    try {
      await resetPassword({
        email: email.toLowerCase().trim(),
        resetToken: resetToken.trim(),
        newPassword,
      });
      setApiMessage("Password updated. You can sign in with your new password.");
      window.setTimeout(() => {
        router.push("/login");
      }, 1500);
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
                setValidationErrors((previous) => ({
                  ...previous,
                  email: undefined,
                }));
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

        <div>
          <Label>
            Reset token <span className="text-error-500">*</span>
          </Label>
          <Input
            id="resetToken"
            placeholder="Paste the reset token"
            type="text"
            value={resetToken}
            onChange={(event) => {
              setResetToken(event.target.value);
              if (validationErrors.resetToken) {
                setValidationErrors((previous) => ({
                  ...previous,
                  resetToken: undefined,
                }));
              }
            }}
            error={!!validationErrors.resetToken}
            disabled={isLoading}
            autoComplete="off"
          />
          {validationErrors.resetToken && (
            <p className="text-error-500 mt-1 text-sm">
              {validationErrors.resetToken}
            </p>
          )}
        </div>

        <div>
          <Label>
            New password <span className="text-error-500">*</span>
          </Label>
          <Input
            id="newPassword"
            placeholder="Enter a new password"
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              if (validationErrors.newPassword) {
                setValidationErrors((previous) => ({
                  ...previous,
                  newPassword: undefined,
                }));
              }
            }}
            error={!!validationErrors.newPassword}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {validationErrors.newPassword && (
            <p className="text-error-500 mt-1 text-sm">
              {validationErrors.newPassword}
            </p>
          )}
        </div>

        <div>
          <Label>
            Confirm password <span className="text-error-500">*</span>
          </Label>
          <Input
            id="confirmPassword"
            placeholder="Confirm the new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (validationErrors.confirmPassword) {
                setValidationErrors((previous) => ({
                  ...previous,
                  confirmPassword: undefined,
                }));
              }
            }}
            error={!!validationErrors.confirmPassword}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {validationErrors.confirmPassword && (
            <p className="text-error-500 mt-1 text-sm">
              {validationErrors.confirmPassword}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading} size="full">
          {isLoading ? "Updating..." : "Reset password"}
        </Button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          <Link
            href="/login"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

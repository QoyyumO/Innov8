"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import EmptyState from "@/components/empty-state/EmptyState";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { toUserFacingError } from "@/lib/userFacingError";
import { readAppError } from "../../../../../convex/lib/appError";
import {
  CURRENT_PASSWORD_INCORRECT_CODE,
  MIN_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "../../../../../convex/lib/authConstants";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const { user, sessionToken } = useAuth();
  const changePasswordMutation = useMutation(api.auth.changePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleInputChange = (
    field: "currentPassword" | "newPassword" | "confirmPassword",
    value: string,
  ) => {
    if (field === "currentPassword") {
      setCurrentPassword(value);
    } else if (field === "newPassword") {
      setNewPassword(value);
    } else {
      setConfirmPassword(value);
    }

    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = "Current password is required";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required";
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = PASSWORD_TOO_SHORT_MESSAGE;
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = "New password must be different from current password";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});

    if (!validate() || !sessionToken) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await changePasswordMutation({
        token: sessionToken,
        currentPassword,
        newPassword,
      });

      if (result.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onSuccess?.();
      } else {
        setApiError("Failed to change password. Please try again.");
      }
    } catch (err) {
      const appError = readAppError(err);
      if (appError?.code === CURRENT_PASSWORD_INCORRECT_CODE) {
        setValidationErrors((prev) => ({
          ...prev,
          currentPassword: appError.message,
        }));
      } else {
        setApiError(toUserFacingError(err, "An unexpected error occurred"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !sessionToken) {
    return (
      <EmptyState
        title="Authentication required"
        description="Please log in to change your password."
        status="error"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {apiError && (
            <Alert variant="error" title="Error" message={apiError} />
          )}

          <PasswordField
            id="currentPassword"
            label="Current password"
            value={currentPassword}
            show={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((prev) => !prev)}
            onChange={(value) => handleInputChange("currentPassword", value)}
            error={validationErrors.currentPassword}
            disabled={isLoading}
            autoComplete="current-password"
            placeholder="Enter your current password"
          />

          <PasswordField
            id="newPassword"
            label="New password"
            value={newPassword}
            show={showNewPassword}
            onToggle={() => setShowNewPassword((prev) => !prev)}
            onChange={(value) => handleInputChange("newPassword", value)}
            error={validationErrors.newPassword}
            disabled={isLoading}
            autoComplete="new-password"
            placeholder="Enter your new password"
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((prev) => !prev)}
            onChange={(value) => handleInputChange("confirmPassword", value)}
            error={validationErrors.confirmPassword}
            disabled={isLoading}
            autoComplete="new-password"
            placeholder="Confirm your new password"
          />

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "Changing..." : "Change password"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onToggle,
  onChange,
  error,
  disabled,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
  autoComplete: string;
  placeholder: string;
}) {
  return (
    <div>
      <Label>
        {label} <span className="text-error-500">*</span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <span
          onClick={onToggle}
          className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
        >
          {show ? (
            <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
          ) : (
            <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
          )}
        </span>
      </div>
      {error && <p className="text-error-500 mt-1 text-sm">{error}</p>}
    </div>
  );
}

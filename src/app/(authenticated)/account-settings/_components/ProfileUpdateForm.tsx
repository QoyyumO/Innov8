"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import EmptyState from "@/components/empty-state/EmptyState";

interface ProfileUpdateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProfileUpdateForm({
  onSuccess,
  onCancel,
}: ProfileUpdateFormProps) {
  const { user, sessionToken } = useAuth();
  const updateProfileMutation = useMutation(api.auth.updateProfile);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});

  useEffect(() => {
    if (user) {
      setFirstName(user.profile.firstName || "");
      setMiddleName(user.profile.middleName || "");
      setLastName(user.profile.lastName || "");
    }
  }, [user]);

  const validate = (): boolean => {
    const errors: { firstName?: string; lastName?: string } = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required";
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    field: "firstName" | "middleName" | "lastName",
    value: string,
  ) => {
    if (field === "firstName") {
      setFirstName(value);
    } else if (field === "middleName") {
      setMiddleName(value);
    } else {
      setLastName(value);
    }

    if ((field === "firstName" || field === "lastName") && validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
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
      const result = await updateProfileMutation({
        token: sessionToken,
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim() || undefined,
        },
      });

      if (result.success) {
        onSuccess?.();
      } else {
        setApiError("Failed to update profile. Please try again.");
      }
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

  if (!user || !sessionToken) {
    return (
      <EmptyState
        title="Authentication required"
        description="Please log in to update your profile."
        status="error"
      />
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {apiError && (
            <Alert variant="error" title="Error" message={apiError} />
          )}

          <div>
            <Label>
              First name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="firstName"
              placeholder="Enter your first name"
              type="text"
              value={firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              error={!!validationErrors.firstName}
              disabled={isLoading}
              autoComplete="given-name"
            />
            {validationErrors.firstName && (
              <p className="text-error-500 mt-1 text-sm">
                {validationErrors.firstName}
              </p>
            )}
          </div>

          <div>
            <Label>Middle name</Label>
            <Input
              id="middleName"
              placeholder="Enter your middle name (optional)"
              type="text"
              value={middleName}
              onChange={(e) => handleInputChange("middleName", e.target.value)}
              disabled={isLoading}
              autoComplete="additional-name"
            />
          </div>

          <div>
            <Label>
              Last name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="lastName"
              placeholder="Enter your last name"
              type="text"
              value={lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              error={!!validationErrors.lastName}
              disabled={isLoading}
              autoComplete="family-name"
            />
            {validationErrors.lastName && (
              <p className="text-error-500 mt-1 text-sm">
                {validationErrors.lastName}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update profile"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

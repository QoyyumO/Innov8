"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isValidEmail } from "@/lib/email";
import { MIN_PASSWORD_LENGTH } from "../../../../../convex/lib/authConstants";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { EyeCloseIcon, EyeIcon } from "@/icons";

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  bannerTitle?: string;
  bannerMessage?: string;
}

export function LoginForm({
  onSuccess,
  redirectTo,
  bannerTitle,
  bannerMessage,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const { login } = useAuth();
  const router = useRouter();

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: "email" | "password", value: string) => {
    if (field === "email") {
      setEmail(value);
    } else {
      setPassword(value);
    }

    if (validationErrors[field]) {
      setValidationErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});

    if (!validate()) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(
        email.toLowerCase().trim(),
        password,
        keepMeLoggedIn,
      );

      if (result.success) {
        onSuccess?.();
        router.push(redirectTo ?? "/");
      } else {
        setApiError(
          result.error ?? "Login failed. Please check your credentials.",
        );
      }
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

  const alertTitle = apiError ? "Authentication Error" : bannerTitle;
  const alertMessage = apiError ?? bannerMessage;
  const alertVariant = apiError ? "error" : "warning";

  return (
    <div className="mx-auto w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {alertTitle && alertMessage && (
            <Alert
              variant={alertVariant}
              title={alertTitle}
              message={alertMessage}
            />
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
              onChange={(event) => handleInputChange("email", event.target.value)}
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
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  handleInputChange("password", event.target.value)
                }
                error={!!validationErrors.password}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
              >
                {showPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                )}
              </span>
            </div>
            {validationErrors.password && (
              <p className="text-error-500 mt-1 text-sm">
                {validationErrors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={keepMeLoggedIn} onChange={setKeepMeLoggedIn} />
              <span className="text-theme-sm block font-normal text-gray-700 dark:text-gray-400">
                Keep me logged in
              </span>
            </div>
            <Link
              href="/forgot-password"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            size="full"
          >
            {isLoading ? "Logging in..." : "Log In"}
          </Button>
        </div>
      </form>
    </div>
  );
}

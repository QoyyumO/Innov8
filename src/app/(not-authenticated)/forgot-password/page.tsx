"use client";

import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      title="Forgot Password"
      description="Enter your email to request a reset link."
      devNote="Dev token: you will receive a placeholder token for testing."
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}

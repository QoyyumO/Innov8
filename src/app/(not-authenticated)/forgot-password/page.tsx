"use client";

import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      title="Forgot Password"
      description="Enter your email to request a reset. If the account exists, instructions are sent out of band."
      devNote="Demo: issue a token with npx convex run internal.auth.issuePasswordResetToken, then open Reset password."
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}

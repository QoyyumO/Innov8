"use client";

import { Suspense } from "react";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import Loading from "@/components/loading/Loading";

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout
      title="Reset password"
      description="Enter the token from your reset instructions and choose a new password."
      devNote="Paste the token. Do not put it in the page URL."
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loading />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthPageLayout>
  );
}

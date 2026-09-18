"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "./_components/LoginForm";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import Loading from "@/components/loading/Loading";

function LoginPageBody() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorTitle = searchParams.get("errorTitle") ?? undefined;
  const errorMessage = searchParams.get("errorMessage") ?? undefined;

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthPageLayout
      title="Innov8 Health"
      description="Secure patient-record access layer"
      subtitle="Sign in to your account"
      devNote="Demo password: password123 · start with ibrahim@fmc.abuja.ng"
      footer={
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Need an account?{" "}
            <span className="font-medium text-brand-500">
              Contact your hospital administrator
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Other demos: fatima@fmc.abuja.ng · chinedu@fmc.lagos.ng ·
            aisha@fmc.lagos.ng · security@innov8.ng · admin@fmc.abuja.ng
          </p>
        </div>
      }
    >
      <LoginForm bannerTitle={errorTitle} bannerMessage={errorMessage} />
    </AuthPageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loading />
        </div>
      }
    >
      <LoginPageBody />
    </Suspense>
  );
}

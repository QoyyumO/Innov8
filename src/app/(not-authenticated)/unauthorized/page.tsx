"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-error-500">403</h1>
        <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
          Access Denied
        </h2>
        <p className="mb-8 max-w-md text-gray-600 dark:text-gray-400">
          You don&apos;t have permission to access this resource.
          {user && (
            <span className="mt-2 block">
              Your current role(s): {user.roles.join(", ")}
            </span>
          )}
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
          <Button variant="primary" onClick={() => router.push("/")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

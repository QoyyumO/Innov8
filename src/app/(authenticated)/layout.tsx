"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/layout/AppShell";
import Loading from "@/components/loading/Loading";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isLoading || !isMounted) {
      return;
    }

    if (!isAuthenticated || !user) {
      router.push(
        "/login?errorTitle=Session Expired&errorMessage=You've been logged out automatically. Please re-authenticate.",
      );
    }
  }, [isAuthenticated, isLoading, isMounted, pathname, router, user]);

  if (!isMounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}

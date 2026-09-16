"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { useAuth } from "@/hooks/useAuth";
import { isClinician } from "@/services/permissions";
import { AlertIcon } from "@/icons";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../convex/lib/demoIds";
import { BreakGlassForm } from "./_components/BreakGlassForm";

function BreakGlassContent() {
  const searchParams = useSearchParams();
  const initialPublicId = searchParams.get("publicId") ?? DEMO_PATIENT_PUBLIC_ID;
  const requestId = searchParams.get("requestId") ?? undefined;
  return (
    <BreakGlassForm
      key={`${initialPublicId}-${requestId ?? "new"}`}
      initialPublicId={initialPublicId}
      requestId={requestId}
    />
  );
}

export default function EmergencyAccessPage() {
  const { user } = useAuth();
  const canUseBreakGlass = user !== null && isClinician(user.roles);

  return (
    <div>
      <PageBreadCrumb pageTitle="Emergency access" />
      {!canUseBreakGlass ? (
        <EmptyState
          title="Clinicians only"
          description="Break-glass access is for doctors, nurses, pharmacists, and laboratory staff in an emergency. Security officers review and can revoke grants on the security page."
          icon={<AlertIcon className="h-12 w-12 text-brand-500" />}
        />
      ) : (
        <ComponentCard
          title="Break-glass emergency access"
          desc="Temporary access to another facility's records when normal access cannot wait."
        >
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            }
          >
            <BreakGlassContent />
          </Suspense>
        </ComponentCard>
      )}
    </div>
  );
}

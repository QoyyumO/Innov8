"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { useAuth } from "@/hooks/useAuth";
import { isClinician } from "@/services/permissions";
import { FileIcon } from "@/icons";
import { AccessRequestForm } from "../_components/AccessRequestForm";

function NewAccessRequestContent() {
  const searchParams = useSearchParams();
  const initialPublicId = searchParams.get("publicId") ?? "";
  return <AccessRequestForm initialPublicId={initialPublicId} />;
}

export default function NewAccessRequestPage() {
  const { user } = useAuth();
  const canRequest = user !== null && isClinician(user.roles);

  return (
    <div>
      <PageBreadCrumb
        items={[
          { name: "Access requests", href: "/requests" },
          { name: "New request" },
        ]}
      />

      {!canRequest ? (
        <EmptyState
          title="Clinicians only"
          description="Record-access requests are made by doctors, nurses, pharmacists, and laboratory staff."
          icon={<FileIcon className="h-12 w-12 text-brand-500" />}
        />
      ) : (
        <div className="space-y-6">
          <Alert
            variant="info"
            title="Every request is evaluated and audited"
            message="Identity, role, facility, purpose, and volume are scored. You will see the decision and the reasons behind it."
          />
          <ComponentCard
            title="Request record access"
            desc="State why you need the records and which sections."
          >
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <Loading />
                </div>
              }
            >
              <NewAccessRequestContent />
            </Suspense>
          </ComponentCard>
        </div>
      )}
    </div>
  );
}

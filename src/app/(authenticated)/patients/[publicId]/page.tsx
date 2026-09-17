"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { UserIcon } from "@/icons";
import { formatPatientName } from "../_components/formatPatientName";
import { RecordExistenceList } from "../_components/RecordExistenceList";
import { ConsentPanel } from "../_components/ConsentPanel";

export default function PatientDiscoveryPage() {
  const params = useParams<{ publicId: string }>();
  const publicIdParam = params.publicId;
  const publicId =
    typeof publicIdParam === "string"
      ? decodeURIComponent(publicIdParam)
      : "";
  const router = useRouter();
  const { sessionToken } = useAuth();
  const discovery = useQuery(
    api.patients.getPatientDiscovery,
    sessionToken && publicId !== ""
      ? { token: sessionToken, publicId }
      : "skip",
  );

  const isLoading =
    sessionToken !== null && publicId !== "" && discovery === undefined;
  const displayName = discovery
    ? formatPatientName(discovery.profile)
    : publicId;

  return (
    <div>
      <PageBreadCrumb
        items={[
          { name: "Patient search", href: "/patients" },
          { name: displayName },
        ]}
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loading />
        </div>
      )}

      {!isLoading && discovery === null && (
        <EmptyState
          title="Patient not found"
          description="No matching public ID in participating facilities. Discovery never dumps a chart."
          icon={<UserIcon className="h-12 w-12 text-brand-500" />}
        />
      )}

      {!isLoading && discovery !== null && discovery !== undefined && (
        <div className="space-y-6">
          <ComponentCard title="Patient identity" desc="Home facility and identifiers only.">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                {formatPatientName(discovery.profile)}
              </h2>
              <Badge color="light" size="sm">
                {discovery.publicId}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Home facility: {discovery.homeFacility.name} ({discovery.homeFacility.code})
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Clinical summary, allergies, medications, and diagnoses are withheld until
              access is granted.
            </p>
          </ComponentCard>

          <ComponentCard
            title="Record existence"
            desc="Where records live — not what they contain."
          >
            <RecordExistenceList facilities={discovery.recordsByFacility} />
          </ComponentCard>

          <ComponentCard
            title="Patient consent"
            desc="Needed before another facility's records can be requested (except in an emergency)."
          >
            <ConsentPanel publicId={discovery.publicId} />
          </ComponentCard>

          <ComponentCard title="Request access">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              State a purpose and the record types you need. The request is scored,
              decided, and audited before anything is released.
            </p>
            <Button
              type="button"
              onClick={() =>
                router.push(
                  `/requests/new?publicId=${encodeURIComponent(discovery.publicId)}`,
                )
              }
            >
              Request access
            </Button>
          </ComponentCard>
        </div>
      )}
    </div>
  );
}

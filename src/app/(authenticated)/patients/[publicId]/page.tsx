"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import { UserIcon } from "@/icons";
import { formatPatientName } from "../_components/PatientSearchForm";
import { RecordExistenceList } from "../_components/RecordExistenceList";

type PatientDiscovery = {
  publicId: string;
  profile: {
    firstName: string;
    lastName: string;
    middleName?: string;
  };
  homeFacility: {
    code: string;
    name: string;
  };
  recordsByFacility: {
    code: string;
    name: string;
    recordTypes: Array<
      "medical_summary" | "allergies" | "medications" | "diagnoses"
    >;
  }[];
};

export default function PatientDiscoveryPage() {
  const params = useParams<{ publicId: string }>();
  const publicIdParam = params.publicId;
  const publicId =
    typeof publicIdParam === "string"
      ? decodeURIComponent(publicIdParam)
      : "";
  const { sessionToken } = useAuth();
  const getPatientDiscovery = useMutation(api.patients.getPatientDiscovery);

  const [discovery, setDiscovery] = useState<PatientDiscovery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDiscovery = async () => {
      if (!sessionToken || publicId === "") {
        if (!cancelled) {
          setIsLoading(false);
          setDiscovery(null);
        }
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        const result = await getPatientDiscovery({
          token: sessionToken,
          publicId,
        });
        if (!cancelled) {
          setDiscovery(result);
        }
      } catch (error) {
        console.error("Error loading patient discovery:", error);
        if (!cancelled) {
          setDiscovery(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load patient discovery.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDiscovery();
    return () => {
      cancelled = true;
    };
  }, [getPatientDiscovery, publicId, sessionToken]);

  const displayName = discovery ? formatPatientName(discovery.profile) : publicId;

  return (
    <div>
      <PageBreadCrumb
        items={[
          { name: "Patient search", href: "/patients" },
          { name: displayName },
        ]}
      />

      {errorMessage && (
        <div className="mb-6">
          <Alert variant="error" title="Discovery failed" message={errorMessage} />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loading />
        </div>
      )}

      {!isLoading && !errorMessage && discovery === null && (
        <EmptyState
          title="Patient not found"
          description="No matching public ID in participating facilities. Discovery never dumps a chart."
          icon={<UserIcon className="h-12 w-12 text-brand-500" />}
        />
      )}

      {!isLoading && discovery !== null && (
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

          <ComponentCard title="Request access">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Purpose, record types, and risk evaluation are the next step. That form
              ships with the access-request ticket.
            </p>
            <Button type="button" disabled>
              Request access
            </Button>
          </ComponentCard>
        </div>
      )}
    </div>
  );
}

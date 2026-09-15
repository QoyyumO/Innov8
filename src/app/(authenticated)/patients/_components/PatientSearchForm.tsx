"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../../convex/lib/synthetic";

export type PatientSearchHit = {
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
};

export function formatPatientName(profile: PatientSearchHit["profile"]): string {
  const parts = [profile.firstName, profile.middleName, profile.lastName].filter(
    (part) => part !== undefined && part.length > 0,
  );
  return parts.join(" ");
}

type PatientSearchFormProps = {
  onResults: (results: PatientSearchHit[]) => void;
};

export function PatientSearchForm({ onResults }: PatientSearchFormProps) {
  const { sessionToken } = useAuth();
  const searchPatients = useMutation(api.patients.searchPatients);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!sessionToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery === "") {
      setErrorMessage("Enter a patient ID or name to search.");
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchPatients({
        token: sessionToken,
        query: trimmedQuery,
      });
      onResults(results);
    } catch (error) {
      console.error("Error searching patients:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Patient search failed. Try again.";
      setErrorMessage(message);
      onResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Search could not run" message={errorMessage} />
      )}

      <div>
        <Label htmlFor="patient-search">Patient ID or name</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Input
            id="patient-search"
            name="query"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={DEMO_PATIENT_PUBLIC_ID}
            autoComplete="off"
            disabled={isLoading}
          />
          <Button type="submit" size="md" disabled={isLoading || !sessionToken}>
            {isLoading ? "Searching…" : "Search"}
          </Button>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Identity and home facility only. Try {DEMO_PATIENT_PUBLIC_ID} for the
          Track C demo.
        </p>
      </div>
    </form>
  );
}

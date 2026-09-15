"use client";

import { useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import EmptyState from "@/components/empty-state/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserIcon } from "@/icons";
import { DEMO_PATIENT_PUBLIC_ID } from "../../../../convex/lib/demoIds";
import {
  formatPatientName,
  PatientSearchForm,
  PatientSearchHit,
} from "./_components/PatientSearchForm";

export default function PatientSearchPage() {
  const [results, setResults] = useState<PatientSearchHit[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleResults = (hits: PatientSearchHit[]) => {
    setHasSearched(true);
    setResults(hits);
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Patient search" />

      <div className="space-y-6">
        <Alert
          variant="info"
          title="Discovery only"
          message={`Look up ${DEMO_PATIENT_PUBLIC_ID} (Chioma Okonkwo). You will see identity and where records exist — not the chart.`}
        />

        <ComponentCard
          title="Find a patient"
          desc="Search by public ID or name. Results do not include clinical content."
        >
          <PatientSearchForm onResults={handleResults} />
        </ComponentCard>

        {hasSearched && results !== null && results.length === 0 && (
          <EmptyState
            title="No matching patient"
            description="Check the public ID or try the family name as stored on the record. Contents are never listed here."
            icon={<UserIcon className="h-12 w-12 text-brand-500" />}
          />
        )}

        {results !== null && results.length > 0 && (
          <ComponentCard title="Matches" desc="Open a patient to see record existence by facility.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-800">
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-left text-sm font-medium text-gray-500"
                    >
                      Name
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-left text-sm font-medium text-gray-500"
                    >
                      Public ID
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-left text-sm font-medium text-gray-500"
                    >
                      Home facility
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map((hit) => (
                    <TableRow
                      key={hit.publicId}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell className="px-4 py-4">
                        <Link
                          href={`/patients/${encodeURIComponent(hit.publicId)}`}
                          className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                        >
                          {formatPatientName(hit.profile)}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge color="light" size="sm">
                          {hit.publicId}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {hit.homeFacility.name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ComponentCard>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import { isClinician } from "@/services/permissions";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/empty-state/EmptyState";
import Loading from "@/components/loading/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileIcon } from "@/icons";
import { HarvestSimulation } from "./_components/HarvestSimulation";
import { StepUpVerification } from "./_components/StepUpVerification";
import {
  OUTCOME_BADGE_COLORS,
  OUTCOME_LABELS,
  PURPOSE_LABELS,
  RECORD_TYPE_LABELS,
  formatRequestTime,
} from "../_components/accessLabels";
import { isGrantLive } from "../_components/emergencyLabels";

const PAGE_SIZE = 10;
const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap";

export default function AccessRequestsPage() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const now = useNow();
  const canRequest = user !== null && isClinician(user.roles);
  const { results, status, loadMore } = usePaginatedQuery(
    api.accessRequests.listMyAccessRequests,
    canRequest && sessionToken ? { token: sessionToken } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  if (!canRequest) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Access requests" />
        <EmptyState
          title="Clinicians only"
          description="Record-access requests are made by doctors, nurses, pharmacists, and laboratory staff. Security officers review blocked requests from the security page."
          icon={<FileIcon className="h-12 w-12 text-brand-500" />}
        />
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Access requests" />

      <ComponentCard
        title="My record-access requests"
        desc="Every request is scored and audited. Open one to see the reasons."
      >
        <div className="flex justify-end">
          <Button size="sm" onClick={() => router.push("/requests/new")}>
            New request
          </Button>
        </div>

        {status === "LoadingFirstPage" && (
          <div className="flex justify-center py-12">
            <Loading />
          </div>
        )}

        {status !== "LoadingFirstPage" && results.length === 0 && (
          <EmptyState
            title="No requests yet"
            description="Search for a patient, then request access with a purpose. Try PAT-002391 for the Track C demo."
            icon={<FileIcon className="h-12 w-12 text-brand-500" />}
          />
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 dark:border-gray-800">
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Requested
                  </TableCell>
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Patient
                  </TableCell>
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Purpose
                  </TableCell>
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Records
                  </TableCell>
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Decision
                  </TableCell>
                  <TableCell isHeader className={HEADER_CELL_CLASS}>
                    Risk
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {results.map((request) => (
                  <TableRow
                    key={request.requestId}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="px-4 py-4 text-sm whitespace-nowrap">
                      <Link
                        href={`/requests/${request.requestId}`}
                        className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                      >
                        {formatRequestTime(request.requestedAt)}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{request.publicId}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {request.targetFacility.name}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {PURPOSE_LABELS[request.purpose]}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {request.recordTypes
                        .map((recordType) => RECORD_TYPE_LABELS[recordType])
                        .join(", ")}
                      {request.recordCount > 1 && (
                        <span className="block text-xs text-warning-600 dark:text-orange-400">
                          {request.recordCount} patient records
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {request.decision && (
                          <Badge
                            color={OUTCOME_BADGE_COLORS[request.decision.outcome]}
                            size="sm"
                          >
                            {OUTCOME_LABELS[request.decision.outcome]}
                          </Badge>
                        )}
                        {request.decision?.allowedUntil !== undefined &&
                          !(
                            request.emergency !== null &&
                            isGrantLive(request.emergency, now)
                          ) &&
                          request.decision.allowedUntil <= now && (
                            <Badge color="light" size="sm">
                              Expired
                            </Badge>
                          )}
                        {request.emergency !== null &&
                          isGrantLive(request.emergency, now) && (
                            <Badge color="warning" variant="solid" size="sm">
                              Break-glass
                            </Badge>
                          )}
                        {!request.decision && !request.emergency && (
                          <Badge color="light" size="sm">
                            Pending
                          </Badge>
                        )}
                      </div>
                      {request.recordCount === 1 &&
                        request.decision?.stepUpAttemptsLeft !== undefined && (
                          <div className="mt-2">
                            <StepUpVerification
                              requestId={request.requestId}
                              publicId={request.publicId}
                              attemptsLeft={request.decision.stepUpAttemptsLeft}
                              size="sm"
                            />
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                      {request.decision ? `${request.decision.riskScore}/100` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(PAGE_SIZE)}
            >
              {status === "LoadingMore" ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </ComponentCard>

      <ComponentCard
        className="mt-6"
        title="Demo: suspicious bulk request"
        desc="Track C step 6 — a sudden 500-record harvest must be blocked and escalated."
      >
        <HarvestSimulation />
      </ComponentCard>
    </div>
  );
}

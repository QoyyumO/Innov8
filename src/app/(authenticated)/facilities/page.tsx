"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import { FacilitiesTable } from "./_components/FacilitiesTable";

export default function FacilitiesPage() {
  const { sessionToken } = useAuth();
  const facilities = useQuery(
    api.dashboards.listFacilities,
    sessionToken ? { token: sessionToken } : "skip",
  );

  return (
    <div>
      <PageBreadCrumb pageTitle="Facilities" />
      <ComponentCard
        title="Participating facilities"
        desc="Hospitals connected to the Innov8 exchange. Each keeps its own records; the exchange only brokers audited, purpose-based access between them."
      >
        <FacilitiesTable facilities={facilities} />
      </ComponentCard>
    </div>
  );
}

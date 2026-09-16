"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { EyeIcon } from "@/icons";
import { WelcomeCard } from "./DashboardWidgets";

export default function PatientDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const name = user
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : "Patient";

  return (
    <div>
      <PageBreadCrumb pageTitle="Patient dashboard" />

      <div className="space-y-6">
        <WelcomeCard
          name={name}
          hospital={user?.hospital}
          department="Home facility"
          roleLabel="Patient"
        >
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={() => router.push("/audit")}>
              My sign-in activity
            </Button>
          </div>
        </WelcomeCard>

        <Alert
          variant="info"
          title="Your records stay at your facility"
          message="Innov8 does not copy your records. Clinicians at other hospitals must request access for a stated purpose, and every request is audited."
        />

        <ComponentCard
          title="Who accessed your records"
          desc="A history of clinicians who viewed your records."
        >
          <EmptyState
            title="Not available yet"
            description="Your access history will appear here once the patient portal is live."
            icon={<EyeIcon className="h-12 w-12 text-brand-500" />}
          />
        </ComponentCard>
      </div>
    </div>
  );
}

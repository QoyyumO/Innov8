"use client";

import { useAuth } from "@/hooks/useAuth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Alert from "@/components/ui/alert/Alert";
import { DocsIcon, EyeIcon, LockIcon } from "@/icons";
import { WelcomeCard } from "./DashboardWidgets";
import { DEMO_PATIENT, patientAccessEvents } from "./dashboardDummy";

export default function PatientDashboard() {
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
        />

        <Alert
          variant="info"
          title="Your records stay at your facility"
          message={`Dummy view for ${DEMO_PATIENT.id}. Innov8 only shows who asked to see your records — it is not a full personal health record.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Home facility"
            value="Lagos"
            description="FMC Lagos"
            icon={<LockIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Views today"
            value="2"
            description="Treatment purpose"
            icon={<EyeIcon className="h-6 w-6 text-brand-500" />}
          />
          <MetricCard
            title="Pending consents"
            value="0"
            description="Should-have after the demo path"
            icon={<DocsIcon className="h-6 w-6 text-brand-500" />}
          />
        </div>

        <ComponentCard
          title="Who accessed your records"
          desc="Dummy access events. A full patient portal comes after the clinician demo works."
        >
          <div className="space-y-3">
            {patientAccessEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between rounded-lg border border-gray-100 p-4 dark:border-gray-800"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90">
                    {event.actor}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {event.facility} · {event.purpose}
                  </p>
                  <p className="text-xs text-gray-500">{event.fields}</p>
                </div>
                <span className="ml-4 text-xs text-gray-500">{event.time}</span>
              </div>
            ))}
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

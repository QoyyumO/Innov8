import AppShell from "@/layout/AppShell";
import MetricCard from "@/components/common/MetricCard";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { AlertIcon, CheckCircleIcon, LockIcon, UserIcon } from "@/icons";

export default function Home() {
  return (
    <AppShell>
      <PageBreadCrumb pageTitle="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            Innov8 Health
          </h1>
          <p className="text-theme-sm mt-1 text-gray-500 dark:text-gray-400">
            Secure, contextual access to patient records across participating
            facilities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="success">Synthetic data</Badge>
          <Button size="sm">Search patient</Button>
        </div>
      </div>

      <Alert
        variant="info"
        title="Track C demo path"
        message="Authenticate, discover PAT-002391 at FMC Lagos, request records for treatment, then prove allow, block, and break-glass."
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Facilities"
          value="2"
          description="FMC Lagos · FMC Abuja"
          icon={<LockIcon />}
        />
        <MetricCard
          title="Patients"
          value="10,000"
          description="Synthetic identities"
          icon={<UserIcon />}
        />
        <MetricCard
          title="Access decisions"
          value="ALLOW"
          description="Low-risk treatment request"
          icon={<CheckCircleIcon />}
        />
        <MetricCard
          title="High-risk blocks"
          value="1"
          description="Mass-record harvest demo"
          icon={<AlertIcon />}
        />
      </div>
    </AppShell>
  );
}

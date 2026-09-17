"use client";

import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import EmptyState from "@/components/empty-state/EmptyState";
import Tabs from "@/components/ui/tabs/Tabs";
import TabPane from "@/components/ui/tabs/TabPane";
import { useAuth } from "@/hooks/useAuth";
import { hasFacilityReviewScope, isAdmin, isSecurityOfficer } from "@/services/permissions";
import { LockIcon } from "@/icons";
import { AlertsTable } from "./_components/AlertsTable";
import { ConsentsTable } from "./_components/ConsentsTable";

export default function SecurityPage() {
  const { user } = useAuth();
  const canReview =
    user !== null && (isSecurityOfficer(user.roles) || isAdmin(user.roles));
  const isFacilityScoped = user !== null && hasFacilityReviewScope(user.roles);

  if (!canReview) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Security" />
        <EmptyState
          title="Security officers only"
          description="Blocked requests and break-glass events are reviewed by security officers and administrators."
          icon={<LockIcon className="h-12 w-12 text-brand-500" />}
        />
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Security" />
      <ComponentCard
        title="Security alerts"
        desc={
          isFacilityScoped
            ? `Alerts for requests to or from ${user?.hospital ?? "your facility"}. Every blocked request raises a high-severity alert and every break-glass grant a medium one. Acknowledge while you investigate; close when resolved. Alerts are never deleted.`
            : "Every blocked access request raises a high-severity alert. Acknowledge while you investigate; close when resolved. Alerts are never deleted."
        }
      >
        <Tabs tabStyle="independent" justifyTabs="left" tabMarginClass="mb-6">
          <TabPane tab="Open">
            <AlertsTable status="open" />
          </TabPane>
          <TabPane tab="Acknowledged">
            <AlertsTable status="acknowledged" />
          </TabPane>
          <TabPane tab="Closed">
            <AlertsTable status="closed" />
          </TabPane>
          <TabPane tab="All">
            <AlertsTable />
          </TabPane>
        </Tabs>
      </ComponentCard>

      <div className="mt-6">
        <ComponentCard
          title="Patient consents"
          desc={
            isFacilityScoped
              ? `Consents held by or granted to ${user?.hospital ?? "your facility"}, newest first. Revoke one if it was recorded in error or the patient withdraws it.`
              : "Newest recorded patient consents across the exchange. Revoke one if it was recorded in error or the patient withdraws it."
          }
        >
          <ConsentsTable />
        </ComponentCard>
      </div>
    </div>
  );
}

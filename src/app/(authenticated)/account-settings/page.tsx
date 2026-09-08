"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import Alert from "@/components/ui/alert/Alert";
import Tabs from "@/components/ui/tabs/Tabs";
import TabPane from "@/components/ui/tabs/TabPane";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import AssignmentCard from "@/components/user-profile/AssignmentCard";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Account settings" />

      {successMessage && (
        <div className="mb-6">
          <Alert variant="success" title="Success" message={successMessage} />
        </div>
      )}

      <Tabs justifyTabs="left" tabStyle="independent">
        <TabPane tab="Profile information">
          <div className="space-y-6">
            <UserMetaCard user={user} />
            <UserInfoCard
              user={user}
              onSuccess={() => handleSuccess("Profile updated successfully.")}
            />
            <AssignmentCard user={user} />
          </div>
        </TabPane>

        <TabPane tab="Change password">
          <ChangePasswordForm
            onSuccess={() => handleSuccess("Password changed successfully.")}
          />
        </TabPane>
      </Tabs>
    </div>
  );
}

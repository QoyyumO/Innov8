"use client";

import AvatarText from "../ui/avatar/AvatarText";
import Badge from "../ui/badge/Badge";
import { User } from "@/context/AuthContext";
import { formatRole } from "@/utils/capitalize";

interface UserMetaCardProps {
  user: User | null;
}

export default function UserMetaCard({ user }: UserMetaCardProps) {
  if (!user) return null;

  const fullName =
    `${user.profile.firstName}${user.profile.middleName ? ` ${user.profile.middleName}` : ""} ${user.profile.lastName}`.trim();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col items-center gap-6 xl:flex-row">
        <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
          <AvatarText className="h-20 w-20 text-lg" name={fullName} />
        </div>
        <div className="text-center xl:text-left">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            {fullName}
          </h4>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {user.hospital}
            {user.department ? ` · ${user.department}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 xl:justify-start">
            {user.roles.map((role) => (
              <Badge key={role} color="primary" size="sm">
                {formatRole(role)}
              </Badge>
            ))}
            <Badge
              color={user.accountStatus === "active" ? "success" : "error"}
              size="sm"
            >
              {capitalizeStatus(user.accountStatus)}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function capitalizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

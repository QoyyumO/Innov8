"use client";

import { User } from "@/context/AuthContext";
import { capitalize, formatRole } from "@/utils/capitalize";

interface AssignmentCardProps {
  user: User | null;
}

export default function AssignmentCard({ user }: AssignmentCardProps) {
  if (!user) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h4 className="text-lg font-semibold text-gray-800 lg:mb-2 dark:text-white/90">
        Role and facility
      </h4>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        These fields come from your hospital assignment and cannot be changed
        here.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
        <InfoField label="Hospital" value={user.hospital} />
        <InfoField label="Department" value={user.department} />
        <InfoField
          label="Role"
          value={user.roles.map(formatRole).join(", ")}
        />
        <InfoField
          label="Account status"
          value={capitalize(user.accountStatus)}
        />
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 capitalize dark:text-white/90">
        {value || "-"}
      </p>
    </div>
  );
}

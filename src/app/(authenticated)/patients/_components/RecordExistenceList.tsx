import Badge from "@/components/ui/badge/Badge";
import type { RecordType } from "../../../../../convex/lib/domain";
import { RECORD_TYPE_LABELS } from "../../_components/accessLabels";

export type FacilityRecordExistence = {
  code: string;
  name: string;
  recordTypes: RecordType[];
};

export function RecordExistenceList({
  facilities,
}: {
  facilities: FacilityRecordExistence[];
}) {
  if (facilities.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No participating facility has indexed records for this patient yet.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {facilities.map((facility) => (
        <li
          key={`${facility.code}-${facility.recordTypes.join("-")}`}
          className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
        >
          <p className="font-medium text-gray-800 dark:text-white/90">
            Records exist at {facility.name}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {facility.code} · existence only — contents are not shown
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {facility.recordTypes.map((recordType) => (
              <Badge key={recordType} color="info" size="sm">
                {RECORD_TYPE_LABELS[recordType]}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

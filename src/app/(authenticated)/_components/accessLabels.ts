import type {
  DecisionOutcome,
  Purpose,
  RecordType,
} from "../../../../convex/lib/domain";

export const RECORD_TYPES: RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
  "lab_results",
];

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  medical_summary: "Medical summary",
  allergies: "Allergies",
  medications: "Medications",
  diagnoses: "Diagnoses",
  lab_results: "Lab results",
};

export const PURPOSE_OPTIONS: { value: Purpose; label: string; hint: string }[] = [
  { value: "treatment", label: "Treatment", hint: "Caring for the patient now" },
  { value: "emergency", label: "Emergency", hint: "Urgent care decision" },
  { value: "referral", label: "Referral", hint: "Patient referred to your team" },
  { value: "follow-up", label: "Follow-up", hint: "Continuing earlier care" },
  { value: "administrative", label: "Administrative", hint: "Non-clinical work — extra scrutiny" },
];

export const PURPOSE_LABELS: Record<Purpose, string> = {
  treatment: "Treatment",
  emergency: "Emergency",
  referral: "Referral",
  "follow-up": "Follow-up",
  administrative: "Administrative",
};

export const OUTCOME_LABELS: Record<DecisionOutcome, string> = {
  ALLOW: "Allowed",
  VERIFY: "Verification required",
  BLOCK: "Blocked",
};

export const OUTCOME_BADGE_COLORS: Record<
  DecisionOutcome,
  "success" | "warning" | "error"
> = {
  ALLOW: "success",
  VERIFY: "warning",
  BLOCK: "error",
};

export const OUTCOME_ALERT_VARIANTS = OUTCOME_BADGE_COLORS;

const requestTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export function formatRequestTime(timestamp: number): string {
  return requestTimeFormatter.format(new Date(timestamp));
}

export function formatRole(role: string): string {
  const spaced = role.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

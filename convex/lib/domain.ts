import { v } from "convex/values";

export const accountStatus = v.union(
  v.literal("active"),
  v.literal("suspended"),
);

export type AccountStatus = "active" | "suspended";

export const personName = v.object({
  firstName: v.string(),
  lastName: v.string(),
  middleName: v.optional(v.string()),
});

export type PersonName = {
  firstName: string;
  lastName: string;
  middleName?: string;
};

export const purpose = v.union(
  v.literal("treatment"),
  v.literal("emergency"),
  v.literal("referral"),
  v.literal("follow-up"),
  v.literal("administrative"),
);

export type Purpose =
  | "treatment"
  | "emergency"
  | "referral"
  | "follow-up"
  | "administrative";

export const recordType = v.union(
  v.literal("medical_summary"),
  v.literal("allergies"),
  v.literal("medications"),
  v.literal("diagnoses"),
);

export type RecordType =
  | "medical_summary"
  | "allergies"
  | "medications"
  | "diagnoses";

export const decisionOutcome = v.union(
  v.literal("ALLOW"),
  v.literal("VERIFY"),
  v.literal("BLOCK"),
);

export type DecisionOutcome = "ALLOW" | "VERIFY" | "BLOCK";

export const alertSeverity = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export type AlertSeverity = "high" | "medium" | "low";

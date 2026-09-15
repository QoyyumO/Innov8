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

export const facilityStatus = v.union(
  v.literal("active"),
  v.literal("pilot"),
);

export type FacilityStatus = "active" | "pilot";

export const gender = v.union(
  v.literal("female"),
  v.literal("male"),
  v.literal("other"),
);

export type Gender = "female" | "male" | "other";

export const bloodGroup = v.union(
  v.literal("A+"),
  v.literal("A-"),
  v.literal("B+"),
  v.literal("B-"),
  v.literal("AB+"),
  v.literal("AB-"),
  v.literal("O+"),
  v.literal("O-"),
);

export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";

export const alertStatus = v.union(
  v.literal("open"),
  v.literal("acknowledged"),
  v.literal("closed"),
);

export type AlertStatus = "open" | "acknowledged" | "closed";

export const auditAction = v.union(
  v.literal("UserLoggedIn"),
  v.literal("PatientSearched"),
  v.literal("AccessRequested"),
  v.literal("AccessAllowed"),
  v.literal("AccessChallenged"),
  v.literal("AccessBlocked"),
  v.literal("RecordViewed"),
  v.literal("EmergencyGranted"),
  v.literal("EmergencyExpired"),
  v.literal("SecurityAlertRaised"),
);

export type AuditAction =
  | "UserLoggedIn"
  | "PatientSearched"
  | "AccessRequested"
  | "AccessAllowed"
  | "AccessChallenged"
  | "AccessBlocked"
  | "RecordViewed"
  | "EmergencyGranted"
  | "EmergencyExpired"
  | "SecurityAlertRaised";

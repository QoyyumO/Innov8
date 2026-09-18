import { Infer, v } from "convex/values";

export const accountStatus = v.union(
  v.literal("active"),
  v.literal("suspended"),
);

export type AccountStatus = Infer<typeof accountStatus>;

export const personName = v.object({
  firstName: v.string(),
  lastName: v.string(),
  middleName: v.optional(v.string()),
});

export type PersonName = Infer<typeof personName>;

export const purpose = v.union(
  v.literal("treatment"),
  v.literal("emergency"),
  v.literal("referral"),
  v.literal("follow-up"),
  v.literal("administrative"),
);

export type Purpose = Infer<typeof purpose>;

export const recordType = v.union(
  v.literal("medical_summary"),
  v.literal("allergies"),
  v.literal("medications"),
  v.literal("diagnoses"),
  v.literal("lab_results"),
);

export type RecordType = Infer<typeof recordType>;

export const decisionOutcome = v.union(
  v.literal("ALLOW"),
  v.literal("VERIFY"),
  v.literal("BLOCK"),
);

export type DecisionOutcome = Infer<typeof decisionOutcome>;

export const alertSeverity = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export type AlertSeverity = Infer<typeof alertSeverity>;

export const facilityStatus = v.union(
  v.literal("active"),
  v.literal("pilot"),
);

export type FacilityStatus = Infer<typeof facilityStatus>;

export const gender = v.union(
  v.literal("female"),
  v.literal("male"),
  v.literal("other"),
  v.literal("unknown"),
);

export type Gender = Infer<typeof gender>;

export const bloodGroup = v.union(
  v.literal("A+"),
  v.literal("A-"),
  v.literal("B+"),
  v.literal("B-"),
  v.literal("AB+"),
  v.literal("AB-"),
  v.literal("O+"),
  v.literal("O-"),
  v.literal("unknown"),
);

export type BloodGroup = Infer<typeof bloodGroup>;

export const alertStatus = v.union(
  v.literal("open"),
  v.literal("acknowledged"),
  v.literal("closed"),
);

export type AlertStatus = Infer<typeof alertStatus>;

/** INN-45: a recorded patient consent is active until it expires or is revoked. */
export const consentStatus = v.union(v.literal("active"), v.literal("revoked"));

export type ConsentStatus = Infer<typeof consentStatus>;

/** INN-45: how consent affected a decision (snapshot on `accessDecisions.factors`). */
export const consentCheck = v.union(
  v.literal("not_required"),
  v.literal("active"),
  v.literal("missing"),
);

export type ConsentCheck = Infer<typeof consentCheck>;

export const auditAction = v.union(
  v.literal("UserLoggedIn"),
  v.literal("UserLoggedOut"),
  v.literal("UserLoginFailed"),
  v.literal("PasswordChanged"),
  v.literal("PasswordReset"),
  v.literal("ProfileUpdated"),
  v.literal("PatientSearched"),
  v.literal("PatientDiscovered"),
  v.literal("AccessRequested"),
  v.literal("AccessAllowed"),
  v.literal("AccessChallenged"),
  v.literal("AccessBlocked"),
  v.literal("AccessExpired"),
  v.literal("RecordViewed"),
  v.literal("EmergencyGranted"),
  v.literal("EmergencyExpired"),
  v.literal("EmergencyRevoked"),
  v.literal("SecurityAlertRaised"),
  v.literal("SecurityAlertAcknowledged"),
  v.literal("SecurityAlertClosed"),
  v.literal("StepUpCompleted"),
  v.literal("ConsentRecorded"),
  v.literal("ConsentRevoked"),
  v.literal("StepUpFailed"),
  v.literal("ClinicalNoteAppended"),
);

export type AuditAction = Infer<typeof auditAction>;

export const auditDetails = v.record(
  v.string(),
  v.union(
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(v.string()),
  ),
);

export type AuditDetails = Infer<typeof auditDetails>;

import type { AuditAction, AuditDetails } from "../../../../convex/lib/domain";
import { formatRequestTime } from "./accessLabels";

type AuditBadgeColor = "primary" | "success" | "error" | "warning" | "info" | "light";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  UserLoggedIn: "Signed in",
  UserLoggedOut: "Signed out",
  UserLoginFailed: "Sign-in failed",
  PasswordChanged: "Password changed",
  PasswordReset: "Password reset",
  ProfileUpdated: "Profile updated",
  PatientSearched: "Patient searched",
  PatientDiscovered: "Patient looked up",
  AccessRequested: "Access requested",
  AccessAllowed: "Access allowed",
  AccessChallenged: "Access challenged",
  AccessBlocked: "Access blocked",
  AccessExpired: "Allowed access expired",
  RecordViewed: "Records viewed",
  EmergencyGranted: "Break-glass granted",
  EmergencyExpired: "Break-glass expired",
  EmergencyRevoked: "Break-glass ended early",
  SecurityAlertRaised: "Security alert raised",
  SecurityAlertAcknowledged: "Security alert acknowledged",
  SecurityAlertClosed: "Security alert closed",
  StepUpCompleted: "Verification completed",
  ConsentRecorded: "Consent recorded",
  ConsentRevoked: "Consent revoked",
  StepUpFailed: "Verification failed",
};

export const AUDIT_ACTION_BADGE_COLORS: Record<AuditAction, AuditBadgeColor> = {
  UserLoggedIn: "light",
  UserLoggedOut: "light",
  UserLoginFailed: "warning",
  PasswordChanged: "warning",
  PasswordReset: "warning",
  ProfileUpdated: "info",
  PatientSearched: "info",
  PatientDiscovered: "info",
  AccessRequested: "primary",
  AccessAllowed: "success",
  AccessChallenged: "warning",
  AccessBlocked: "error",
  AccessExpired: "warning",
  RecordViewed: "success",
  EmergencyGranted: "warning",
  EmergencyExpired: "light",
  EmergencyRevoked: "light",
  SecurityAlertRaised: "error",
  SecurityAlertAcknowledged: "info",
  SecurityAlertClosed: "light",
  StepUpCompleted: "success",
  ConsentRecorded: "success",
  ConsentRevoked: "warning",
  StepUpFailed: "warning",
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

const MAX_DETAIL_LENGTH = 80;

function humanizeKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDetailValue(key: string, value: AuditDetails[string]): string {
  if (value === null) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "number" && key.endsWith("At")) {
    return formatRequestTime(value);
  }
  const text = String(value);
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…` : text;
}

/** Short `label: value` pairs for the table; `requestId` is shown as a link instead. */
export function summarizeAuditDetails(details: AuditDetails): { label: string; value: string }[] {
  return Object.entries(details)
    .filter(([key]) => key !== "requestId")
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatDetailValue(key, value) }));
}

/** The access request an event is about, if any. */
export function findAuditRequestId(event: {
  entity: string;
  entityId: string | null;
  details: AuditDetails;
}): string | null {
  if (event.entity === "accessRequests" && event.entityId) {
    return event.entityId;
  }
  return typeof event.details.requestId === "string" ? event.details.requestId : null;
}

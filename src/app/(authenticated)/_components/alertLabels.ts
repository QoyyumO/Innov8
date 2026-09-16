import type { AlertSeverity, AlertStatus } from "../../../../convex/lib/domain";

export const ALERT_SEVERITY_BADGE_COLORS: Record<
  AlertSeverity,
  "error" | "warning" | "info"
> = {
  high: "error",
  medium: "warning",
  low: "info",
};

export const ALERT_STATUS_BADGE_COLORS: Record<
  AlertStatus,
  "error" | "warning" | "light"
> = {
  open: "error",
  acknowledged: "warning",
  closed: "light",
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  closed: "Closed",
};

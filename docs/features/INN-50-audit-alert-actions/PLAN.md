# INN-50: Audit alert acknowledge and close actions — Implementation Plan

**Git branch:** `INN-50-audit-alert-actions`

## Context

Security officers and admins can acknowledge and close alerts (INN-39), but those actions weren't written to the audit log, so `/audit` (INN-42) couldn't show who handled an alert or when. Filed as a follow-up during INN-42; owner Adebare. Stacked on INN-44 (#16), because both add `auditAction` values and edit the same docs.

---

## Scope

- [x] `auditAction` gains `SecurityAlertAcknowledged` and `SecurityAlertClosed`
- [x] `transitionAlert(db, reviewer, alertId, nextStatus, now)` audits each successful transition: the officer as actor (with session), entity `securityAlerts`, details `{ fromStatus, toStatus, severity }`
- [x] Invalid transitions still throw, so nothing is written (the mutation rolls back)
- [x] `/audit` labels the two actions
- [x] Tests in `convex/alerts.test.ts`
- [x] Docs updated

---

## Implementation

`convex/alerts.ts` passes the session context from `requireAlertReviewer` and `Date.now()` into `transitionAlert`. The service maps the target status to the audit action (`acknowledged` → `SecurityAlertAcknowledged`, `closed` → `SecurityAlertClosed`). Closing an open alert directly is audited as `SecurityAlertClosed` with `fromStatus: "open"`.

---

## Open questions

- [ ] None.

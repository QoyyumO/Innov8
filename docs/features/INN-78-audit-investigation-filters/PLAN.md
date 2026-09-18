# INN-78: Audit investigation filters — Implementation Plan

**Git branch:** `INN-78-audit-investigation-filters`

## Context

FR-17: officers should filter audit events by user, patient, hospital, date/time, event type, risk level, and access decision. Today `/audit` is newest-first with an action filter and an actor link. No first-class patient, facility, risk, or decision filters. Clinicians and patients keep seeing only their own trail.

Stacked on INN-77.

---

## Scope

- [x] Indexes first (no `.collect()` on `auditEvents`)
- [x] Reviewer UI: patient publicId (`auditEvents.patientId`), facility (`auditEventFacilities`), date range on `createdAt`
- [x] Decision outcome via existing decision audit actions (ALLOW/VERIFY/BLOCK). No risk-score index (would scan); score stays in details
- [x] Non-reviewers ignore investigation filters and still see only their own events

---

## Implementation

### Part A — Indexes + query

`by_patientId_action_createdAt`, `by_patientId_actorId_createdAt`, `by_patientId_actorId_action_createdAt` on `auditEvents`.

`listAuditEvents` optional `patientPublicId`, `facilityId`, `outcome`, `createdFrom`, `createdTo`.

---

## Open questions

- None. Risk-level filter omitted (no indexed `riskScore` on `auditEvents`).

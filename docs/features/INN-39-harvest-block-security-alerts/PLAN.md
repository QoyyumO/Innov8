# INN-39: Harvest BLOCK, security alerts API, and /security UI — Implementation Plan

**Git branch:** `INN-39-harvest-block-security-alerts` (stacked on `INN-40-authorised-clinical-summary`, PR #10, to keep the stack linear)

## Context

Demo step 6. The same clinician suddenly asks for 500 patient records: the request must BLOCK at ~94, raise a high-severity security alert, and audit both. A security officer reviews the alert on `/security`. `createAccessRequest` always scores one patient and takes no count from the client (Qoyyum, `a2ca4d8`), so this ticket adds a server-side harvest mutation plus the alert, the officer's queue, and a demo button. Blocked by INN-37 and INN-38 (PRs #9, #8). Owner: Adebare.

---

## Scope

- [x] `convex/lib/services/alertService.ts` — raise a `securityAlerts` row + `SecurityAlertRaised` audit on every BLOCK
- [x] `simulateBulkHarvest` mutation — server fixes the volume at 500; client passes only `token` and `publicId`
- [x] Shared `recordAccessRequest` helper so `createAccessRequest` (count 1) and `simulateBulkHarvest` (count 500) store, score, audit, and alert the same way
- [x] `convex/alerts.ts` — `listSecurityAlerts` (paginated, security officers + admins), `acknowledgeAlert`, `closeAlert`
- [x] Status transitions only (open → acknowledged → closed, open → closed); rows are never deleted
- [x] `/requests`: "Simulate bulk harvest (500 records)" card for clinicians
- [x] `/security` page with `AlertsTable` (status tabs, severity badges, harvest highlight, acknowledge / close)
- [x] Security dashboard: dummy alert list replaced with the live open-alert queue
- [x] Tests in `convex/alerts.test.ts`
- [x] Docs updated

Out of scope: dashboard metric cards (INN-43), break-glass alerts (INN-41), audit rows for acknowledge/close (no `auditAction` value exists yet).

---

## Implementation

### Part A — Server-side harvest and alert service

`convex/accessRequests.ts`: the body of `createAccessRequest` moves into `recordAccessRequest(ctx, session, { publicId, purpose, recordTypes, recordCount })`. `createAccessRequest` passes `recordCount: 1`; `simulateBulkHarvest(token?, publicId)` passes `HARVEST_RECORD_COUNT` (500, from `convex/lib/riskConstants.ts`), purpose `treatment`, and all four record types, storing one request row like the §14 seed. Both are clinicians only. Neither accepts a count from the client.


`raiseBlockAlert(db, { decisionId, actor, patientPublicId, recordCount, riskScore, reasons, sessionId, createdAt })`

- Inserts `securityAlerts` with `severity: "high"`, `status: "open"`, `decisionId`.
- Title: "Bulk record harvest blocked" when `recordCount >= 500`, else "High-risk access request blocked".
- Message: "`<name>` (`<hospital>`) requested `<n>` patient record(s) (`<publicId>`). Risk `<score>`/100. `<reasons>`" — no clinical content.
- Audits `SecurityAlertRaised` (`entity: "securityAlerts"`) with the actor and session.

### Part B — Public API (`convex/alerts.ts`)

- `listSecurityAlerts(token?, status?, paginationOpts)` — security officers and admins only (`requireRole`). With a status: `by_status_createdAt`; without: `by_createdAt`; newest first by `createdAt`; `.paginate()`. Each row joins decision → request → actor → patient for display (`riskScore`, `outcome`, `recordCount`, `publicId`, requester name / hospital, `requestId`, `isHarvest`). Auth errors return an empty finished page.
- `acknowledgeAlert(token?, alertId)` — open → acknowledged.
- `closeAlert(token?, alertId)` — open or acknowledged → closed.
- Invalid transitions throw "Alert is already <status>"; unknown ids throw "Alert not found".

### Part C — UI

- `requests/_components/HarvestSimulation.tsx` on `/requests` (clinicians) — explains the demo and calls `simulateBulkHarvest` for PAT-002391; shows `DecisionResult` (BLOCK 94) and a note that security has been alerted.
- `security/page.tsx` — security officers and admins; tabs Open / Acknowledged / Closed / All (existing `Tabs` component if it fits, else buttons); `security/_components/AlertsTable.tsx` with severity and status badges, requester, patient, record count, risk, time, link to the request, harvest rows highlighted, Acknowledge / Close buttons; "Load more".
- `SecurityDashboard.tsx` — the dummy "Security alerts" card becomes a live preview of the newest open alerts (compact `AlertsTable`); metric cards stay dummy until INN-43.

### Part D — Tests (`convex/alerts.test.ts`)

`simulateBulkHarvest` → one request row with count 500, BLOCK 94 + one open high alert + `AccessBlocked` and `SecurityAlertRaised` audits; it and `createAccessRequest` both reject a client count; clinicians only; ALLOW and VERIFY (administrative request after hours = 43) raise nothing; alert text has no clinical content; security officer and admin can list, clinicians / patients / anonymous cannot; status filter and newest-first pagination; acknowledge and close transitions, invalid transitions rejected, rows never deleted; clinicians cannot change status.

---

## Open questions

- [ ] Add `AlertAcknowledged` / `AlertClosed` to `auditAction` so officer actions are audited? Needs a small schema change; left for a follow-up.

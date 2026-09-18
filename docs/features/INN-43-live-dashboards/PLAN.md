# INN-43: Live clinician and security dashboards — Implementation Plan

**Git branch:** `INN-43-live-dashboards`

## Context

The live demo path (INN-35 → INN-42) works, but every role dashboard still reads `dashboardDummy.ts`, and `/facilities` 404s. This ticket binds the dashboards to real rows with bounded queries and adds a facilities page. Unblocked; owner Adebare.

---

## Scope

- [x] `convex/dashboards.ts` — `getClinicianDashboard`, `getSecurityDashboard`, `listFacilities`, all bounded (no `.collect()`)
- [x] "Today" is passed in by the client (`since` = start of the Lagos day), so counts do not depend on server time and stay cacheable
- [x] Clinician dashboards (doctor, nurse, pharmacist, laboratory) share one live component: requests today by outcome, last decision, latest blocked harvest, active break-glass, recent requests
- [x] Security dashboard: open alerts by severity (matches `securityAlerts` with `status: "open"`, capped), blocked today, active break-glass, audit events today, live alert queue, latest decisions
- [x] Admin dashboard: live exchange summary + facilities; dummy worker directory removed
- [x] Patient dashboard: no dummy numbers (access history is INN-46)
- [x] `/facilities` page listing the seeded hospitals
- [x] `dashboardDummy.ts` deleted; nothing imports it
- [x] Tests in `convex/dashboards.test.ts`
- [x] Docs updated

---

## Implementation

### Part A — Backend

#### A1. Indexes

`accessDecisions`: replace `by_outcome` (no callers) with `by_outcome_decidedAt` so "blocked today" is a range read and the newest blocks come first.

#### A2. `convex/lib/dashboardConstants.ts` (client-safe)

`startOfLagosDay(timestamp)` (WAT is UTC+1, no DST) and the caps: recent requests 10, harvest look-back 50, today counts 100, open alerts 200, audit today 200, active grants 20.

#### A3. `getClinicianDashboard({ token, since })`

Clinicians only (auth errors → `null`).

- One read of the caller's newest 50 requests (`by_actorId_requestedAt`). The first 10 become table rows, the first decided one is "last decision", and the newest harvest-sized one with a BLOCK is "latest blocked harvest".
- Requests since `since` (same index, range, capped) with their decisions → counts by outcome.
- Live grants: newest 20 by `by_actorId`, unrevoked and unexpired.

#### A4. `getSecurityDashboard({ token, since })`

Security officers and admins only (auth errors → `null`).

- Open alerts: `by_status_createdAt` = open, capped, counted by severity.
- Blocked today: `by_outcome_decidedAt` range.
- Audit events today: `by_createdAt` range, capped.
- Active grants: `by_expiresAt` > now, unrevoked, with the holder's name.
- Latest decisions: `by_decidedAt` desc, 10 rows with requester.

#### A5. `listFacilities({ token })`

Any signed-in user; `by_code`, capped at 50.

### Part B — Frontend

- `ClinicianDashboard.tsx` + per-role copy replaces `DoctorDashboard` / `NurseDashboard` / `PharmacistDashboard` / `LaboratoryDashboard`.
- `DashboardWidgets.tsx`: `WelcomeCard`, `DashboardRequestsTable` (live rows), `useStartOfToday`, count formatting (`"100+"` when capped).
- `SecurityDashboard.tsx`, `AdminDashboard.tsx`, `PatientDashboard.tsx` rewired.
- `facilities/page.tsx` + `FacilitiesTable`.
- Countdowns use `useNow` so break-glass cards drop grants that expire while the page is open.

---

## Open questions

- [ ] Worker and patient totals are not shown: counting 500 workers / 10k patients needs stored counters. Out of scope.
- [ ] Patient access history on the patient dashboard is INN-46.
- [ ] Facility-scoped views for hospital admins (INN-52). Out of scope; the security/admin dashboard is exchange-wide.

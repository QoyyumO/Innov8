# INN-53: Stored counters for worker and patient totals — Implementation Plan

**Git branch:** `INN-53-facility-stat-counters`

## Context

`/facilities` and the admin dashboard (INN-43) couldn't show how many healthcare workers or patients each facility has: counting about 500 users and about 10,000 patients live would break the bounded-read rule. This follow-up stores the totals instead. Stacked on INN-52 (#19), which touches the same seed, dashboard, and docs; owner Adebare.

---

## Scope

- [x] `facilityStats` table: `facilityId`, `workerCount`, `patientCount`, `updatedAt` (`by_facilityId`)
- [x] `convex/lib/facilityStats.ts`: `insertCountedUser` / `patchCountedUser` / `insertCountedPatient` / `patchCountedPatient` keep totals exact on every insert and facility or role change; `getFacilityTotals` / `setFacilityTotals`
- [x] A **worker** is a user linked to a facility with at least one non-patient role (the seed links Chioma's patient login to FMC Lagos; it isn't counted)
- [x] All user and patient writes in `convex/seed.ts` go through the helpers (including linking demo users created at login, and moving the demo patient to Lagos)
- [x] `convex/facilityStatsRecount.ts`: batched, idempotent rebuild (`npx convex run facilityStatsRecount:start`)
- [x] `listFacilities` returns `workerCount` / `patientCount`; `getSecurityDashboard` returns `population` (exchange-wide sum for security officers and system admins; own facility for hospital admins)
- [x] UI: worker and patient columns on `/facilities`; "Healthcare workers" and "Patients" cards on the admin dashboard
- [x] Tests in `convex/facilityStats.test.ts`
- [x] Docs updated

---

## Implementation

### Why simple counters

Users and patients are only created or moved by the seed (and by demo-user creation at login, which never links a facility), so a few helpers cover every write path. That avoids adding the Convex aggregate component as a new dependency. Any future create, move, or delete path for users or patients must use the helpers.

### Recount

`start` schedules one chain per facility. Each chain pages through workers (`users.by_facilityId`), then patients (`patients.by_homeFacilityId`), carrying the running count between batches, and sets each total at the end of its pass. Run it while no seeding is in progress; a concurrent seed could be counted twice. Wipe does not recount. `seedPatientsBatch` schedules a recount only after the last patient write.

### Bounded reads

`listFacilities` and the exchange-wide `population` share one indexed `facilityStats` page (at most 50 rows).

---

## Open questions

- [ ] Suspended accounts still count as workers (there is no account-status change path yet).

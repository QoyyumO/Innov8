# INN-18: Convex schema for the access layer — Implementation Plan

**Git branch:** `INN-18-convex-schema-access-layer`

## Context

Owner: Adebare. Parent for the schema split (INN-20…INN-30). Keep existing `users` and `sessions`. Add one table (or validator set) per child. Follow `Innov8_DDD.md`. Do not seed in this ticket — that is Henry / INN-19. Seed is implemented separately (`docs/features/INN-19-synthetic-datasets-from-section-14/PLAN.md`).

---

## Scope

- [x] INN-20 Shared validators in `convex/lib/domain.ts`
- [x] INN-21 `facilities`
- [x] INN-22 `patients`
- [x] INN-23 `recordIndexes`
- [x] INN-24 `clinicalSummaries`
- [x] INN-25 `accessRequests`
- [x] INN-26 `accessDecisions`
- [x] INN-27 `emergencyAccess`
- [x] INN-28 `securityAlerts`
- [x] INN-29 `auditEvents`
- [x] INN-30 Optional worker fields on `users` (no second identity table)

Style: `defineTable` + `v.*`, camelCase, `v.id("table")`, closed enums, nested name objects, unix-ms timestamps, indexes `by_<field>` (no `_creationTime`). New `users` fields must be `v.optional(...)`.

---

## Implementation

### Part A — INN-20 validators

#### A1. `convex/lib/domain.ts`

Purpose, RecordType, DecisionOutcome, AlertSeverity, AccountStatus (extracted from users), personName matching users `profile`. Export TS types next to validators. No tables.

### Part B — INN-21 facilities

#### B1. Table

`code`, `name`, `city`, `status` (`active` | `pilot`). Indexes `by_code`, `by_name`. No hospital-to-hospital wiring. Keep string `hospital` on users until INN-30 adds optional `facilityId`.

### Part C — INN-22 patients

Identity only: `publicId`, `homeFacilityId`, `profile`, `dateOfBirth`, `gender`, `bloodGroup`, `searchName`. Indexes `by_publicId`, `by_homeFacilityId`, `by_searchName`. No clinical arrays on this table.

### Part D — INN-23 recordIndexes

Existence + `recordTypes` only. Indexes `by_patientId`, `by_facilityId`, `by_patientId_facilityId`.

### Part E — INN-24 clinicalSummaries

Source-facility payload after ALLOW. Index `by_patientId_facilityId`. Schema only — no public query.

### Part F — INN-25 accessRequests

Actor, session, patient, source/target facility, purpose, recordTypes, optional recordCount/device/location, `requestedAt`. Indexes as in the ticket.

### Part G — INN-26 accessDecisions

One row per request: outcome, riskScore, required `reasons`, `decidedAt`, optional factor snapshot. Indexes `by_requestId`, `by_outcome`, `by_decidedAt`.

### Part H — INN-27 emergencyAccess

Justification required. Indexes `by_actorId`, `by_patientId`, `by_expiresAt`. Schema only.

### Part I — INN-28 securityAlerts

Optional links to decision / emergency access. Indexes `by_status`, `by_severity`, `by_createdAt`.

### Part J — INN-29 auditEvents

Append-only shape. Indexes `by_actorId`, `by_action`, `by_createdAt`. No public update/delete.

### Part K — INN-30 users worker fields

Keep workers on `users` (no `workers` table). Optional `facilityId`, `workerId`, `normalAccessHours` `{ start, end }`, `normalPatientVolume`. Indexes `by_workerId`, `by_facilityId`. Do not break `ibrahim@fmc.abuja.ng`.

---

## Open questions

- [x] Workers table vs users — **users**, optional fields (INN-30)
- [x] Unique constraints — Convex indexes are not unique; seed/mutations call `convex/lib/invariants.ts` (`requireUnusedFacilityCode`, `requireUnusedPatientPublicId`, `requireUnusedWorkerId`, `requireUnusedDecisionRequestId`)
- [x] Empty reasons / justification / risk 0–100 — same helpers (`assertDecisionReasons`, `assertNonEmptyString`, `assertRiskScore`)
- [x] gender / bloodGroup — closed enums plus `unknown` for §14 rows without a coded value

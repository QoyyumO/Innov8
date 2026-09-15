# INN-19: Synthetic datasets from Section 14 — Implementation Plan

**Git branch:** `henry` (work also tagged `INN-19-synthetic-seed`)  
**PR:** [https://github.com/QoyyumO/Innov8/pull/1](https://github.com/QoyyumO/Innov8/pull/1)

## Context

Owner: Henry. Parent for the three §14 datasets. Insert Convex documents that match **INN-18** tables (`convex/schema.ts` + `convex/lib/domain.ts`). Do **not** invent a parallel CSV schema. Blocked by INN-18 (merged). Synthetic only. Demo login `ibrahim@fmc.abuja.ng` / `password123` must keep working.

---

## Scope

- [x] INN-19 facilities fixture (FMC-LOS, FMC-ABJ, FMC-ABK) with `status: "active"`
- [x] INN-32 — 500 healthcare workers on `users` + INN-30 fields; update demo users; Chioma patient user not counted
- [x] INN-31 — 10,000 patients including **PAT-002391** (Chioma Okonkwo, FMC Lagos) + `recordIndexes` + `clinicalSummaries`
- [x] INN-33 — 100,000 access events (~95% ALLOW / 5% VERIFY or BLOCK); alerts on BLOCK; Ibrahim ALLOW ~8 and harvest BLOCK ~94
- [x] Batched `internalMutation`s + scheduler; `args`/`returns`; idempotent index lookups
- [x] `verifyDemoSeed` + contributor runbook (`README.md`, `convex/README-seeding.md`)

---

## Implementation

### Part A — Shared fixtures

#### A1. `convex/lib/demoUsers.ts`

Same demo accounts as login. `convex/auth.ts` imports this list so emails cannot drift.

#### A2. `convex/lib/synthetic.ts`

Deterministic PRNG, name pools, `RECORD_TYPES` / `PURPOSES` from domain validators, facilities with `status`.

### Part B — INN-32 workers

#### B1. `seedHealthcareWorkers`

Patch existing demo rows with `facilityId`, `workerId` (`WRK-00001`…), `normalAccessHours`, `normalPatientVolume`. Insert remaining ids through `WRK-00500`. Skip Chioma for workerId.

### Part C — INN-31 patients

#### C1. `seedPatientsBatch`

Scheduler self-chain (`batchSize` 250, `total` 10000). Identity shape: `publicId`, `homeFacilityId`, `profile`, unix `dateOfBirth`, `gender`, `bloodGroup`, `searchName`. One record index + clinical summary per home facility (`by_patientId_facilityId`). PAT-002391 forced to Lagos / Chioma Okonkwo / four record types.

### Part D — INN-33 access events

#### D1. `seedAccessEventsBatch`

Each event: `accessRequests` + `accessDecisions` + `AccessRequested` and outcome audit. `securityAlerts` (`severity: "high"`) on BLOCK. Idempotent via `by_actorId_requestedAt`. Cursor `0` also inserts the two Ibrahim demo rows.

### Part E — Verify and docs

#### E1. `verifyDemoSeed`

Internal query for facilities count, Ibrahim workerId, PAT-002391, allow/block scores.

#### E2. Runbooks

Root `README.md` (setup + smoke/full seed). `convex/README-seeding.md` (indexes, demo guarantees).

---

## Verification (personal Convex **dev**)

Ran on `terrific-ptarmigan-848` (not prod):

- 3 facilities, 500 worker ids, patients through **PAT-010000**
- 100k access-event batches completed
- Browser: sign out → login `ibrahim@fmc.abuja.ng` / `password123` → Doctor dashboard

`verifyDemoSeed` after 100k: allow **8**, block **94**. Newest BLOCK alerts can push the harvest alert out of the last-25 check; the Ibrahim BLOCK row remains.

---

## Open questions

- [x] Parallel schema — **no**; seed maps onto INN-18 only
- [x] 100k in one mutation — **no**; scheduler pages
- [x] Demo harvest as one `accessRequests` row with `recordCount: 500` (table is per-patient)

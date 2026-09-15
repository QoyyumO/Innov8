# INN-19 — §14 synthetic data seeding

Maps work-document §14 onto the INN-18 Convex tables in `convex/schema.ts`
(`convex/lib/domain.ts` validators). Do not add a parallel schema.

Internal mutations are CLI/dashboard-only, not client-callable.

## Run order (full §14 volumes)

CLI names are either `internal.seed.<fn>` or `seed:<fn>`.

```bash
npx convex dev

# 1. Facilities (FMC Lagos / Abuja / Abeokuta)
npx convex run internal.seed.seedFacilities

# 2. Healthcare workers (update demo logins + fill WRK-00001…WRK-00500)
npx convex run internal.seed.seedHealthcareWorkers '{"count": 500}'

# 3. Patients + recordIndexes + clinicalSummaries (10,000; includes PAT-002391)
npx convex run internal.seed.seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 10000}'

# 4. Access events (~95% ALLOW / 5% VERIFY or BLOCK). Run after step 3 finishes.
#    100k events is a large write — use a preview/dev deployment the team agrees on.
npx convex run internal.seed.seedAccessEventsBatch '{"cursor": 0, "batchSize": 200, "total": 100000, "patientCount": 10000, "workerCount": 500}'
```

Watch dashboard logs until scheduled batches complete (~40 patient batches,
~500 event batches at size 200).

## Pre-merge / smoke verification

Seeds the demo path without writing 100k access events. PAT-002391 is patient
index 2391, so patient `total` must be at least 2391.

```bash
npx convex run internal.seed.seedFacilities
npx convex run internal.seed.seedHealthcareWorkers '{"count": 500}'
npx convex run internal.seed.seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 2391}'
# Wait until scheduled patient batches finish, then:
npx convex run internal.seed.seedAccessEventsBatch '{"cursor": 0, "batchSize": 20, "total": 20, "patientCount": 2391, "workerCount": 500}'
npx convex run internal.seed.verifyDemoSeed
```

`verifyDemoSeed` should report:

- `facilities`: 3
- `ibrahimWorkerId`: `WRK-00001`
- `demoPatient.publicId`: `PAT-002391`, name Chioma Okonkwo, home `FMC-LOS`
- `allowRiskScore`: 8
- `blockRiskScore`: 94
- `blockAlertSeverity`: `high`

Then sign in at the app with `ibrahim@fmc.abuja.ng` / `password123`.

## Idempotency

- Facilities: `by_code`
- Workers: `by_email` / `by_workerId`
- Patients: `by_publicId`; record index + summary via `by_patientId_facilityId`
- Access events: `accessRequests.by_actorId_requestedAt` (deterministic timestamps)

## Demo guarantees

- `PAT-002391` is Chioma Okonkwo, home facility FMC Lagos, with a Lagos
  record index and clinical summary (summary / allergies / medications / diagnoses).
- `ibrahim@fmc.abuja.ng` / `password123` stays loginable. Seed sets
  `facilityId`, `workerId` `WRK-00001`, and hour/volume baselines.
- Chioma’s patient *user* is not counted as one of the 500 workers.
- First access-event batch also inserts:
  1. Ibrahim → PAT-002391, purpose `treatment`, risk `8`, `ALLOW`
  2. Same actor, `recordCount` 500, risk `94`, `BLOCK` + high-severity alert

## Linear

Parent [INN-19](https://linear.app/innov8-health/issue/INN-19) ·
[INN-31](https://linear.app/innov8-health/issue/INN-31) patients ·
[INN-32](https://linear.app/innov8-health/issue/INN-32) workers ·
[INN-33](https://linear.app/innov8-health/issue/INN-33) access events.

## Files

- `convex/lib/demoUsers.ts` — shared demo accounts (also used by `convex/auth.ts`)
- `convex/lib/synthetic.ts` — deterministic generators
- `convex/seed.ts` — `internalMutation`s plus `verifyDemoSeed`

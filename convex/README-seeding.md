# INN-19 — §14 synthetic data seeding

Maps work-document §14 onto the INN-18 Convex tables in `convex/schema.ts`
(`convex/lib/domain.ts` validators). Do not add a parallel schema.

## Run order

```bash
npx convex dev

# 1. Facilities (FMC Lagos / Abuja / Abeokuta)
npx convex run internal.seed.seedFacilities

# 2. Healthcare workers (update demo logins + fill WRK-00001…WRK-00500)
npx convex run internal.seed.seedHealthcareWorkers '{"count": 500}'

# 3. Patients + recordIndexes + clinicalSummaries (10,000; includes PAT-002391)
npx convex run internal.seed.seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 10000}'

# 4. Access events (~95% ALLOW / 5% VERIFY or BLOCK). Run after step 3 finishes.
npx convex run internal.seed.seedAccessEventsBatch '{"cursor": 0, "batchSize": 200, "total": 100000, "patientCount": 10000, "workerCount": 500}'
```

Watch dashboard logs until scheduled batches complete (~40 patient batches,
~500 event batches at size 200).

Internal mutations are CLI/dashboard-only, not client-callable.

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

## Files

- `convex/lib/demoUsers.ts` — shared demo accounts (also used by `convex/auth.ts`)
- `convex/lib/synthetic.ts` — deterministic generators
- `convex/seed.ts` — `internalMutation`s above

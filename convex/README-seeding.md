# INN-19 — §14 synthetic data seeding

## ⚠️ Before merging
`convex/schema.ts` here is **provisional**. It adds the tables §14 needs
(`facilities`, `patients`, `recordIndexes`, `clinicalSummaries`,
`accessRequests`, `accessDecisions`, `auditEvents`, `securityAlerts`) and
extends `users` with `facilityId` / worker fields, in the same style as the
existing tables — but INN-18 (Adebare, access-layer schema) and INN-30
(Adebare, extend users) are still open. Reconcile field names/shapes with
Adebare's actual schema before merging; don't ship this schema file as-is
without his sign-off.

## Run order

```bash
npx convex dev   # generates convex/_generated, needed for the imports below

# 1. Facilities fixture (3 rows)
npx convex run seed:seedFacilities

# 2. Healthcare workers (500 rows)
npx convex run seed:seedHealthcareWorkers '{"count": 500}'

# 3. Patients + recordIndexes + clinicalSummaries (10,000 patients)
#    Self-chains via the scheduler in batches of 250 until done.
npx convex run seed:seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 10000}'

# 4. Access events (100,000 rows, ~5% anomalous)
#    Run AFTER step 3 finishes. Self-chains in batches of 500.
npx convex run seed:seedAccessEventsBatch '{"cursor": 0, "batchSize": 500, "total": 100000, "patientCount": 10000, "workerCount": 500}'
```

Watch the dashboard logs / function list to confirm each scheduled batch
completes before assuming the dataset is fully seeded (step 3 schedules ~40
batches, step 4 schedules ~200 batches).

## Idempotency
Every insert is guarded by a lookup on a unique index first
(`by_code`, `by_workerId`, `by_publicId`), matching the `ensureDemoUsers`
pattern in `convex/auth.ts`. Re-running any of these commands skips rows
that already exist rather than duplicating them.

## Guarantees satisfied
- `PAT-002391` exists (patient #2391 in the sequential `PAT-######` id space).
- `ibrahim@fmc.abuja.ng` / `password123` is untouched — it's seeded by the
  existing `ensureDemoUsers` in `convex/auth.ts`, not touched by this seed
  script.
- ~95% of access events are normal, ~5% flagged anomalous (denied request +
  a `securityAlerts` row), per §14.
- All data is synthetic — no real patient data anywhere in these generators.
- `args` + `returns` validators are set on every function.
- 100,000-row dataset is batched (scheduler self-chaining); no single
  mutation inserts more than `batchSize` documents.

## Files
- `convex/schema.ts` — provisional schema extension (see caveat above)
- `convex/lib/synthetic.ts` — deterministic generators / name & data lists
- `convex/seed.ts` — the four `internalMutation`s described above

# Demo-scale synthetic data seeding

Maps the Track C demo onto the INN-18 Convex tables in `convex/schema.ts`
(`convex/lib/domain.ts` validators). Do not add a parallel schema.

Internal mutations are CLI/dashboard-only, not client-callable.

**Do not seed the historical §14 volumes** (500 workers, 10,000 patients,
100,000 access events) on the Convex free plan. Those counts overflow the
512 MB storage cap. Defaults live in `convex/lib/synthetic.ts`
(`SEED_WORKER_COUNT` 24, `SEED_PATIENT_COUNT` 200, `SEED_ACCESS_EVENT_COUNT` 200).

## Wipe an oversized deployment

Cancel leftover `seedPatientsBatch` / `seedAccessEventsBatch` jobs in the
Convex dashboard (Schedules) first, or a wipe will race a refill.

```bash
npx convex run internal.seed.clearSeedDataBatch
```

Watch logs until `{ table: "users", done: true }`. Deletes facility join
rows (`auditEventFacilities`, `alertFacilities`), audit events, alerts,
emergency grants, decisions, requests, summaries, record indexes, consents,
patients, facility stats, reset tokens, sessions, and extra workers
(`WRK-00025+`). Keeps the 3 facilities and demo login emails. Totals are
rebuilt when the next `seedPatientsBatch` finishes, not during the wipe.

Row-by-row deletes can time out on a 100k-event database ("too many system
operations"). Faster wipe for an oversized deployment: `npx convex import
--replace --table <name> empty.json -y` with `[]` for `auditEventFacilities`,
`alertFacilities`, `auditEvents`, `accessDecisions`, `accessRequests`,
`patients`, `recordIndexes`, `clinicalSummaries`, `securityAlerts`,
`consents`, `facilityStats`, then `sessions` / `passwordResetTokens`. Then
run `clearSeedDataBatch` with `{"tableIndex": 14}` to trim extra workers.

Row-by-row deletes also count toward monthly database I/O. If mutations stall
because the team is over quota, create a new empty Convex project, point
`.env.local` at it, deploy + seed, then delete the old project.

## Run order (demo-scale)

CLI names are either `internal.seed.<fn>` or `seed:<fn>`.

```bash
npx convex dev

# One-shot: facilities → 24 workers → 200 patients + PAT-002391 → 200 events
npx convex run internal.seed.seedDemoDataset
```

Or step by step:

```bash
npx convex run internal.seed.seedFacilities
npx convex run internal.seed.seedHealthcareWorkers
npx convex run internal.seed.seedPatientsBatch '{"continueToEvents": true}'
```

Watch dashboard logs until scheduled patient and event batches complete.
Then:

```bash
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

PAT-002391 is upserted on the first patient batch even when `total` is 200.

## Idempotency

- Facilities: `by_code`
- Workers: `by_email` / `by_workerId`
- Patients: `by_publicId`; record index + summary via `by_patientId_facilityId`
- Access events: `accessRequests.by_actorId_requestedAt` (deterministic timestamps)
- Re-running seed does **not** shrink storage — wipe first

## Demo guarantees

- `PAT-002391` is Chioma Okonkwo, home facility FMC Lagos, with a Lagos
  record index and clinical summary (summary / allergies / medications / diagnoses).
- `ibrahim@fmc.abuja.ng` / `password123` stays loginable. Seed sets
  `facilityId`, `workerId` `WRK-00001`, and hour/volume baselines.
- Chioma’s patient *user* is not counted as a worker.
- First access-event batch also inserts:
  1. Ibrahim → PAT-002391, purpose `treatment`, risk `8`, `ALLOW`
  2. Same actor, `recordCount` 500, risk `94`, `BLOCK` + high-severity alert

## Linear

[INN-55](https://linear.app/innov8-health/issue/INN-55) shrinks the operational
seed. Parent [INN-19](https://linear.app/innov8-health/issue/INN-19) ·
[INN-31](https://linear.app/innov8-health/issue/INN-31) patients ·
[INN-32](https://linear.app/innov8-health/issue/INN-32) workers ·
[INN-33](https://linear.app/innov8-health/issue/INN-33) access events remain Done.

## Files

- `convex/lib/demoUsers.ts` — shared demo accounts (also used by `convex/auth.ts`)
- `convex/lib/synthetic.ts` — deterministic generators and seed volume constants
- `convex/seed.ts` — `internalMutation`s plus `verifyDemoSeed`

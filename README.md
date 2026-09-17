# Innov8 Health

NITDA / ICSC Track C: a **secure patient-record access layer**, not a hospital EMR. Synthetic data only.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, [Convex](https://convex.dev). UI lives in `src/`. Backend lives in `convex/`.

## Prerequisites

- Node.js 20+ and npm
- A [Convex](https://dashboard.convex.dev) account (free)

## Setup

```bash
git clone <this-repo>
cd innov8
npm install
npx convex dev
```

The first `npx convex dev` logs you in, creates (or links) a **dev** deployment, and writes `.env.local` with `NEXT_PUBLIC_CONVEX_URL` (and `CONVEX_DEPLOYMENT`). Leave that process running.

In a **second** terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The login page is `/login`.

You always need **both** processes: Next.js for the UI, Convex for the database and functions.

## Demo logins

Password for all demo accounts: `password123`

| Email | Role |
| --- | --- |
| `ibrahim@fmc.abuja.ng` | Doctor (FMC Abuja, Cardiology) — Track C walkthrough |
| `fatima@fmc.abuja.ng` | Nurse |
| `chinedu@fmc.lagos.ng` | Pharmacist |
| `aisha@fmc.lagos.ng` | Laboratory |
| `admin@fmc.abuja.ng` | Hospital admin |
| `security@innov8.ng` | Security officer |
| `chioma@patient.innov8.ng` | Patient (not a healthcare worker) |

Demo users are created on first login (`ensureDemoUsers` in `convex/auth.ts`). Seed (below) attaches `facilityId`, `workerId`, and hour/volume baselines without changing the password.

Sessions last **30 minutes**. Suspended accounts are rejected on every authenticated call, not just at login.

### Password reset (demo)

There is no email provider yet. `/forgot-password` always shows a generic message and never returns a token. To test the reset flow, issue a one-time token from the CLI (valid 15 minutes, single use):

```bash
npx convex run internal.auth.issuePasswordResetToken '{"email":"ibrahim@fmc.abuja.ng"}'
```

Then open `/reset-password?email=ibrahim@fmc.abuja.ng` and paste the token.

## What works today

Track C demo steps (see `AGENTS.md`):

| Step | Status |
| --- | --- |
| 1. Authenticate | Done — session login (failed passwords return a form error, not an overlay), 30-minute sessions or 7 days with Keep me logged in, role-aware sidebar, `UserLoggedIn` audit |
| 2. Search PAT-002391 | Done — `/patients` and `/patients/[publicId]` (clinicians only); identity + record existence, no clinical contents; `PatientSearched` audit (including zero-result searches) |
| 3–4. Purpose request + risk decision | Done — `/requests/new` (or **Request access** on a patient page): purpose + record types → stored request, risk score (INN-38), ALLOW / VERIFY / BLOCK with every reason; `/requests` lists your requests; `AccessRequested` + outcome audit. Ibrahim → PAT-002391 treatment = 8 ALLOW (the seed gives PAT-002391 consent for FMC Abuja). Cross-facility single-patient requests need **patient consent** (except purpose emergency): without it they are VERIFY with a "no active patient consent" reason; clinicians record consent on the patient page (30 days, audited) and security officers / admins can revoke it on `/security`. A VERIFY request opens a **Complete verification** dialog: re-entering your password turns it into ALLOW; three wrong passwords block it and alert security (all audited) |
| 5. Authorised summary | Done — on an allowed request, **View authorised records** releases only the requested sections from the facility that holds them (e.g. FMC Lagos for PAT-002391); BLOCK / VERIFY release nothing; each view is audited as `RecordViewed`. Allowed access lasts **24 hours** from the decision; after that the request page shows **Request access again**, and any attempt to open the records is refused and audited as `AccessExpired` |
| 6. Harvest BLOCK + alert | Done — **Simulate bulk harvest (500 records)** on `/requests` calls `simulateBulkHarvest` (the server fixes the count) → BLOCK 94; every BLOCK raises a high-severity alert (`SecurityAlertRaised` audit); security officers and admins review, acknowledge, and close alerts on `/security`; each acknowledge / close is audited with the officer's name |
| 7. Break-glass | Done — `/emergency` (or **Use break-glass** on a blocked or challenged request): a clinician gives a written justification and confirms; the server grants 15 minutes of access (the client cannot choose the length), raises a medium alert, and audits `EmergencyGranted`. Records open on the request page while the grant is live; it ends by scheduled expiry (`EmergencyExpired`) or when the holder or a security officer ends it early (`EmergencyRevoked`) |
| Audit trail | Done — `/audit` lists audit events newest first, 25 at a time, with an action filter. Clinicians and patients see only their own activity; security officers and system admins see everyone's; hospital admins see their own staff plus every request to or from their facility. Reviewers can open one person's trail. Read-only: nothing edits or deletes audit rows |
| Live dashboards + facilities | Done — every role dashboard reads live, bounded data. Clinicians (doctor, nurse, pharmacist, laboratory) see their requests today by outcome, last decision, latest blocked harvest, active break-glass, and recent requests. Security officers and system admins see open alerts by severity, blocks today, active break-glass, audit volume today, the live alert queue, and the latest decisions; hospital admins see the same summary for their facility plus the facility list. `/facilities` lists the participating hospitals with their stored worker and patient totals. "Today" means since midnight in Lagos. Chioma's patient dashboard shows PAT-002391 identity, home facility, and a bounded history of audit events that name her (after seed links `users.patientId`) |

## Seed synthetic data

Seed is **internal** Convex mutations (`convex/seed.ts`). Run them from the CLI or dashboard, not from the browser. Functions are idempotent: re-running skips rows that already exist.

Keep `npx convex dev` running so functions are pushed, then in another terminal.

**Use the demo-scale seed only.** Historical §14 volumes (500 workers, 10,000 patients, 100,000 access events) overflow the Convex free-plan storage cap. Do not run those counts on this team.

If an existing deployment already has the large seed, cancel leftover scheduled seed jobs in the Convex dashboard, then wipe before reseeding:

```bash
npx convex run internal.seed.clearSeedDataBatch
```

Watch dashboard logs until `{ done: true }` on `users`. Facilities are kept; extra `WRK-00025+` workers are removed. Then:

```bash
npx convex run internal.seed.seedDemoDataset
npx convex run internal.seed.verifyDemoSeed
```

`seedDemoDataset` inserts 3 facilities, 24 workers, 200 patients **plus PAT-002391**, and 200 access events including Ibrahim ALLOW 8 / BLOCK 94. Equivalent step-by-step:
```bash
npx convex run internal.seed.seedFacilities
npx convex run internal.seed.seedHealthcareWorkers
npx convex run internal.seed.seedPatientsBatch '{"continueToEvents": true}'
```

Wait until scheduled patient and event batches finish (`done: true`), then `verifyDemoSeed`. It should show 3 facilities, Ibrahim `WRK-00001`, PAT-002391 at FMC-LOS, allow risk `8`, block risk `94`. `seedPatientsBatch` also records PAT-002391's consent for FMC Abuja (INN-45), which keeps the live treatment request at 8. Then sign in as Ibrahim.

PAT-002391 is always upserted on the first patient batch; `total` no longer needs to be 2391.

**Existing deployments (seeded before INN-52):** run `npx convex run facilityScopeBackfill:start` once so hospital admins can see older alerts and audit events. It runs in scheduled batches and is safe to re-run.

**Existing deployments (seeded before INN-53):** run `npx convex run facilityStatsRecount:start` once (while no seed is running) to fill in per-facility worker and patient totals. It is batched and safe to re-run.

More detail (indexes, demo rows, files): [`convex/README-seeding.md`](convex/README-seeding.md).

## Checks

```bash
npm run check   # eslint + next typegen + tsc --noEmit
npm test        # vitest + convex-test (convex/**/*.test.ts)
```

Both run on a clean clone (`npm ci` works; no Husky or `prepare` script). Run them before opening a PR.

## Repo map

- `src/app/(authenticated)/` — dashboard, `patients/`, `requests/`, `emergency/`, `security/`, `audit/`, `facilities/`, `account-settings/`; shared labels in `_components/accessLabels.ts`, `alertLabels.ts`, `emergencyLabels.ts`, and `auditLabels.ts`
- `src/app/(not-authenticated)/` — `login/`, `forgot-password/`, `reset-password/`, `unauthorized/`
- `src/hooks/useAuth.ts` — how pages pass the session token to Convex
- `convex/schema.ts` — access-layer tables
- `convex/auth.ts` — login, session, password reset (`innov8_session_token`)
- `convex/patients.ts` — patient search + existence-only discovery
- `convex/accessRequests.ts` — create / list / view purpose-based access requests and decisions
- `convex/records.ts` — release authorised clinical sections after ALLOW (or a live emergency grant)
- `convex/emergency.ts` — break-glass grant, active-grant lookup, early revoke, scheduled expiry
- `convex/alerts.ts` — security alert queue, acknowledge, close
- `convex/audit.ts` — read-only, role-scoped audit trail
- `convex/dashboards.ts` — bounded live dashboard summaries and the facility list
- `convex/seed.ts` — internal demo-scale seed and wipe mutations
- `convex/lib/facilityScope.ts` — hospital-admin facility scope (INN-52); `convex/facilityScopeBackfill.ts` — one-time backfill
- `convex/consents.ts` + `convex/lib/services/consentService.ts` — patient consent for cross-facility requests (INN-45)
- `convex/lib/facilityStats.ts` — stored per-facility worker / patient totals (INN-53); `convex/facilityStatsRecount.ts` — rebuild
- `convex/lib/session.ts` — `requireSession`, `publicUser`
- `convex/lib/roles.ts` — `requireRole` and role groups
- `convex/lib/services/` — domain services (`accessControlService`, `alertService`, `auditLogService`, `emergencyAccessService`, `patientDiscoveryService`, `recordExchangeService`, `riskScoringService`)
- `convex/*.test.ts` — backend tests
- `docs/features/` — one `PLAN.md` per ticket ([index](docs/README.md))
- `Innov8_DDD.md` — domain map (do not invent SIMS/school entities)

Linear workspace: [Innov8](https://linear.app/innov8-health) (`INN-XX` only).

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
| 1. Authenticate | Done — session login, role-aware sidebar, `UserLoggedIn` audit |
| 2. Search PAT-002391 | Done — `/patients` and `/patients/[publicId]` (clinicians only); identity + record existence, no clinical contents; `PatientSearched` audit |
| 3–4. Purpose request + risk decision | Not yet — INN-37 (request) and INN-38 (risk scoring) |
| 5. Authorised summary | Not yet — INN-40 |
| 6. Harvest BLOCK + alert | Not yet — INN-39 |
| 7. Break-glass | Not yet — INN-41 |
| Audit trail / security dashboards | Not yet — INN-42, INN-43 |

Role dashboards still show **dummy** numbers. Sidebar links for `/requests`, `/emergency`, `/audit`, `/security`, and `/facilities` 404 until their tickets land.

## Seed synthetic data

Seed is **internal** Convex mutations (`convex/seed.ts`). Run them from the CLI or dashboard, not from the browser. Functions are idempotent: re-running skips rows that already exist.

Keep `npx convex dev` running so functions are pushed, then in another terminal:

### Smoke (demo path only)

Enough for PAT-002391 and Ibrahim ALLOW / BLOCK. Patient index 2391 must exist, so `total` must be at least `2391`.

```bash
npx convex run internal.seed.seedFacilities
npx convex run internal.seed.seedHealthcareWorkers '{"count": 500}'
npx convex run internal.seed.seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 2391}'
```

Wait until dashboard logs show patient batches finished (`done: true`), then:

```bash
npx convex run internal.seed.seedAccessEventsBatch '{"cursor": 0, "batchSize": 20, "total": 20, "patientCount": 2391, "workerCount": 500}'
npx convex run internal.seed.verifyDemoSeed
```

`verifyDemoSeed` should show 3 facilities, Ibrahim `WRK-00001`, PAT-002391 at FMC-LOS, allow risk `8`, block risk `94`. Then sign in as Ibrahim.

### Full §14 volumes

Do this on a **dev** (or preview) deployment the team agrees on. 100k access events is a large write — do not run `--prod` unless that is explicit.

```bash
npx convex run internal.seed.seedFacilities
npx convex run internal.seed.seedHealthcareWorkers '{"count": 500}'
npx convex run internal.seed.seedPatientsBatch '{"cursor": 0, "batchSize": 250, "total": 10000}'
```

Wait for ~40 patient batches to finish, then:

```bash
npx convex run internal.seed.seedAccessEventsBatch '{"cursor": 0, "batchSize": 200, "total": 100000, "patientCount": 10000, "workerCount": 500}'
```

Watch the Convex dashboard until scheduled event batches complete (~500 batches at size 200). Equivalent CLI names: `seed:seedFacilities`, etc.

More detail (indexes, demo rows, files): [`convex/README-seeding.md`](convex/README-seeding.md).

## Checks

```bash
npm run check   # eslint + next typegen + tsc --noEmit
npm test        # vitest + convex-test (convex/**/*.test.ts)
```

Both run on a clean clone (`npm ci` works; no Husky or `prepare` script). Run them before opening a PR.

## Repo map

- `src/app/(authenticated)/` — dashboard, `patients/`, `account-settings/`
- `src/app/(not-authenticated)/` — `login/`, `forgot-password/`, `reset-password/`, `unauthorized/`
- `src/hooks/useAuth.ts` — how pages pass the session token to Convex
- `convex/schema.ts` — access-layer tables
- `convex/auth.ts` — login, session, password reset (`innov8_session_token`)
- `convex/patients.ts` — patient search + existence-only discovery
- `convex/seed.ts` — internal §14 seed mutations
- `convex/lib/session.ts` — `requireSession`, `publicUser`
- `convex/lib/roles.ts` — `requireRole` and role groups
- `convex/lib/services/` — domain services (`auditLogService`, `patientDiscoveryService`)
- `convex/*.test.ts` — backend tests
- `docs/features/` — one `PLAN.md` per ticket ([index](docs/README.md))
- `Innov8_DDD.md` — domain map (do not invent SIMS/school entities)

Linear workspace: [Innov8](https://linear.app/innov8-health) (`INN-XX` only).

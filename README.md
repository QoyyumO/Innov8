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
npm run check   # eslint + tsc --noEmit
```

## Repo map

- `src/app/` — `(authenticated)` and `(not-authenticated)` routes
- `convex/schema.ts` — access-layer tables
- `convex/auth.ts` — session login (`innov8_session_token`)
- `Innov8_DDD.md` — domain map (do not invent SIMS/school entities)

Linear workspace: [Innov8](https://linear.app/innov8-health) (`INN-XX` only).

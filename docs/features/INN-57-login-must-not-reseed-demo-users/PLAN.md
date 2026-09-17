# INN-57: Security: public login mutation re-seeds demo users on every attempt — Implementation Plan

**Git branch:** `INN-57-login-must-not-reseed-demo-users`

## Context

`login` is a public, unauthenticated mutation. Its first step currently walks all eight `DEMO_USERS` and inserts any that are missing, with `accountStatus: "active"` and the hardcoded demo password. Deleting or suspending a demo account does not stick: any anonymous login recreates it. Failed logins also pay eight indexed reads (and up to eight inserts) before the password is checked.

Owner: follow-up from the 2026-09-17 full-codebase review. No schema change.

---

## Scope

- [x] Export `ensureDemoUsers` as an `internalMutation` (skip existing emails so a suspend is not overwritten)
- [x] Call it from the seed path (`seedHealthcareWorkers` / `seedDemoDataset`)
- [x] `login` looks up the user and verifies the password only; writes are session insert + `UserLoggedIn` audit
- [x] Tests that log in as a demo user seed via the internal mutation first
- [x] Prove login does not recreate missing users; a suspended demo account stays suspended
- [x] Docs: demo users come from seed, not first login

---

## Implementation

### Part A — Auth

#### A1. Internal seed helper

`convex/auth.ts`: keep skip-if-exists; wrap as `internal.auth.ensureDemoUsers`. Remove the call from `login`.

### Part B — Seed

#### B1. Worker seed

`convex/seed.ts` `seedHealthcareWorkers`: `ctx.runMutation(internal.auth.ensureDemoUsers, {})` before attaching `facilityId` / `workerId` / baselines. The existing DEMO_USERS loop still patches those fields (and remains a fallback insert if a row is missing).

### Part C — Tests and docs

#### C1. Tests

Shared `convex/lib/loginForTests.ts` so convex-test helpers call `internal.auth.ensureDemoUsers` before `login`. New cases in `auth.test.ts` for empty DB, suspend-sticks, and no extra user inserts on a successful login.

#### C2. Docs

`README.md`, `AGENTS.md`, `Innov8_DDD.md`, `docs/README.md`, `.cursor/rules/innov8-next-tasks.mdc`.

---

## Open questions

- None. Ticket is explicit: seeding only; login must not write users.

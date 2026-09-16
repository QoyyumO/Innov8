# INN-49: Sync docs with current product state and add INN-35 tests — Implementation Plan

**Git branch:** `INN-49-sync-docs-and-add-inn-35-tests`

## Context

Docs fell behind `main` after INN-35, INN-36, INN-47 and INN-48 merged: stale "in progress" statuses, no mention of `npm test` or the CLI password-reset flow, and Convex boilerplate in `convex/README.md`. The INN-35 test suite was written after PR #3 was already merged, so it never landed. Docs and tests only; no behavior changes.

---

## Scope

- [x] `README.md` — "What works today", 30-minute sessions, CLI password-reset demo, `npm test`, repo map
- [x] `docs/README.md` — INN-35, INN-36, INN-48 marked done with PR links; add INN-49
- [x] `AGENTS.md` + `.cursor/rules/innov8-next-tasks.mdc` — done list, next tickets in dependency order, keep-docs-current rule
- [x] `Innov8_DDD.md` — done section, `PasswordResetToken`, per-service status
- [x] `convex/README.md` — map of this backend instead of Convex boilerplate
- [x] `convex/session.test.ts` — 15 INN-35 tests; INN-35 `PLAN.md` scope ticked

---

## Implementation

### Part A — Docs

Every statement checked against `main` (`b8b770f`): function lists from `convex/*.ts`, routes from `src/app/**/page.tsx`, session TTL and reset-token TTL from `convex/lib/session.ts` and `convex/lib/authConstants.ts`, scripts from `package.json`, ticket dependencies from Linear.

### Part B — Tests

`convex/session.test.ts` uses the shared `modules` from `convex/test.setup.ts`. Covers the `UserLoggedIn` audit row, unchanged login response shape, `requireSession` rejections (missing / empty / unknown / expired token, deleted user, suspended account), `requireRole` per group, and `appendAuditEvent` (default and explicit `createdAt`, blank entity, off-enum action, insert-only exports).

---

## Open questions

- [ ] None.

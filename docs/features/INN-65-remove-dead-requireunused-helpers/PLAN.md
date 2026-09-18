# INN-65: Remove dead requireUnused* helpers from invariants.ts — Implementation Plan

**Git branch:** `INN-65-remove-dead-requireunused-helpers`

## Context

Four exported helpers in `convex/lib/invariants.ts` have no callers. `requireUnusedDecisionRequestId` implies one decision per request, but that is already enforced by `.unique()` on `accessDecisions.by_requestId`. Ticket: delete the four unused exports.

---

## Scope

- [x] Delete `requireUnusedFacilityCode`, `requireUnusedPatientPublicId`, `requireUnusedWorkerId`, `requireUnusedDecisionRequestId`
- [x] Leave `assertNonEmptyString`, `assertDecisionReasons`, `assertRiskScore`
- [x] `npm run check` / `npm test`

---

## Implementation

### Part A — invariants.ts

Delete the four unused async helpers and unused `Db` / `Id` imports.

---

## Open questions

- None. Deleting is the accepted option; do not wire the helpers at insert sites.

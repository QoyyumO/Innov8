# INN-62: Dashboards read the oldest break-glass grant, not the newest — Implementation Plan

**Git branch:** `INN-62-newest-break-glass-grant`

## Context

Found in the 2026-09-17 full-codebase review. `toDashboardRow` in `convex/dashboards.ts` looked up a request's emergency grant with `.first()` and no order. On a Convex index that returns the **oldest** matching row.

A request can carry more than one grant. `requireEligibleRequest` only asks that the decision be BLOCK or VERIFY, so once a 15-minute grant lapses the clinician can break glass on the same request again. From the second grant on, `isLiveGrant` was evaluated against the first, expired one, and the row reported `isBreakGlass: false` — no break-glass badge on either dashboard while emergency access was actually live. A live override going unshown is the exact failure the security dashboard exists to prevent.

`convex/accessRequests.ts` did the same lookup correctly, with `.order("desc")`. Two copies, one right and one wrong, is why this went unnoticed.

---

## Scope

- [x] The dashboards read the newest grant on a request
- [x] One shared lookup, so the two call sites cannot drift again
- [x] Test for the two-grant case (expired + live) on both dashboards
- [x] Leave the "list live grants" queries alone — they filter on `expiresAt > now` and collect a set, so row order cannot pick a wrong one

---

## Implementation

### Part A — `convex/lib/services/emergencyAccessService.ts`

Add `findLatestGrantForRequest(db, requestId)` next to `listGrantsForRequest`: `by_requestId`, `.order("desc")`, `.first()`. The doc comment states why the order is load-bearing, since `.first()` looks harmless at a call site.

### Part B — call sites

`convex/dashboards.ts` (the bug) and `convex/accessRequests.ts` (already correct) both drop their inline query and call the helper. Behaviour in `accessRequests.ts` is unchanged; it moves so there is one definition rather than two that agree today.

### Part C — Tests

`convex/dashboards.test.ts`: Ibrahim breaks glass on a BLOCKed request, it lapses, he breaks glass again. Both `getClinicianDashboard` and `getSecurityDashboard` must report `isBreakGlass: true`. The BLOCK decision is what puts the request in the security dashboard's `recentDecisions`.

The existing "leaves out expired and revoked grants" test still passes: with the fix the newest row is the revoked one, which `isLiveGrant` rejects.

Deliberate-break: removing `.order("desc")` from the shared helper fails this test and nothing else — `accessRequests.test.ts` never covered the two-grant case, and now inherits the coverage through the shared helper.

---

## Open questions

- [x] Should the other `emergencyAccess` reads in `dashboards.ts` be ordered too? No — they are `expiresAt > now` range reads feeding a set, not a single-row pick.

# INN-63: Status-filtered alert tabs are not ordered newest first — Implementation Plan

**Git branch:** `INN-63-status-filtered-alerts-newest-first`

## Context

`listSecurityAlerts` uses `by_status` (implicit `_creationTime`) when a status filter is set, and `by_createdAt` when it is not. Seeded alerts backdate `createdAt`, so the Open / Acknowledged / Closed tabs on `/security` do not match the All tab. `by_severity` has no callers.

---

## Scope

- [x] Add `securityAlerts` index `by_status_createdAt` `["status", "createdAt"]`
- [x] Use it for the filtered list and for the dashboard open-alert take
- [x] Remove unused `by_status` and `by_severity`
- [x] Test that filtered order follows `createdAt` even when `_creationTime` disagrees
- [x] `npm run check` / `npm test`

---

## Implementation

### Part A — schema and queries

`convex/schema.ts`, `convex/alerts.ts`, `convex/dashboards.ts`.

### Part B — tests

`convex/alerts.test.ts`: insert two open alerts with swapped `createdAt` vs insert order.

---

## Open questions

- None. Ticket says replace the filtered index and drop `by_severity`.

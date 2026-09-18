# INN-67: Seed writes audit rows directly and with the wrong entityId — Implementation Plan

**Git branch:** `INN-67-seed-audit-alert-entityid`

## Context

`seedAccessEvent` already routes history through `appendAuditEvent`, but `SecurityAlertRaised` still stores `entityId: decisionId` instead of the alert id. Production `raiseBlockAlert` uses the alert id so `/audit` and facility links can resolve the row.

---

## Scope

- [x] Seeded `SecurityAlertRaised` uses the alert id as `entityId`
- [x] No `ctx.db.insert("auditEvents", …)` in `convex/seed.ts`
- [x] Test that the seeded alert audit points at a `securityAlerts` row
- [x] Re-seeding still skips existing events (same counts)

---

## Implementation

### Part A — `convex/seed.ts`

Pass `alertId` as `entityId`. Put `decisionId` in `details` like `alertService`.

### Part B — `convex/seed.test.ts`

After seeding a BLOCK event, assert `SecurityAlertRaised.entityId` matches the inserted alert.

---

## Open questions

- None. Direct inserts are already gone; this ticket is the remaining entityId bug.

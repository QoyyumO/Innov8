# INN-72: Audit failed login attempts (FR-16) — Implementation Plan

**Git branch:** `INN-72-audit-failed-login-attempts`

## Context

FR-16 expects failed authentication in the audit trail. Tests currently require a failed login to write **no** row, so officers cannot see credential stuffing.

Stacked on INN-71.

---

## Scope

- [x] `UserLoginFailed` on wrong password, inactive account, and unknown email
- [x] Same client error as today; no password or session token in details
- [x] Unknown email: no address in details (no user-enumeration oracle)
- [x] Update `session.test.ts`

---

## Implementation

### Part A — `convex/auth.ts` + `auditAction`

### Part B — tests and `/audit` labels

---

## Open questions

- None.

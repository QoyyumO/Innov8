# INN-70: Make "log out everywhere" O(1) with users.sessionsInvalidatedAt — Implementation Plan

**Git branch:** `INN-70-sessions-invalidated-at`

## Context

INN-64 pages session deletes so `resetPassword` cannot blow transaction limits. Sessions past the 500-row cap still authenticate until the scheduled continuation finishes. Stacked on INN-69 / INN-67.

---

## Scope

- [x] Optional `users.sessionsInvalidatedAt`
- [x] Stamp it on password reset and password change
- [x] `getUnexpiredSession` rejects sessions with `createdAt` earlier than the stamp
- [x] `changePassword` issues a fresh session and returns the new token; caller stays signed in
- [x] Test: a leftover session row created before the stamp does not authenticate

---

## Implementation

### Part A — schema + session check

`convex/schema.ts`, `convex/lib/session.ts`.

### Part B — auth + client

`convex/auth.ts`, `AuthContext` + `ChangePasswordForm`.

### Part C — tests

`convex/sessions.test.ts`, `convex/auth.test.ts`.

---

## Open questions

- None. Paged deletion stays as housekeeping.

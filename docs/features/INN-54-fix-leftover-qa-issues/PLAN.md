# INN-54: Fix leftover QA issues — Implementation Plan

**Git branch:** `INN-54-fix-leftover-qa-issues`

## Context

QA leftovers after the demo path: failed login throws (Next.js overlay), session-expired query params are ignored, Keep me logged in is a dead checkbox, the login alert always says “Invalid credentials”, seeded non-harvest requests show “4 patient records”, and the mobile header/sidebar overlay steals breadcrumb clicks. Dashboards, `/audit`, `/facilities`, and `useNow` are out of scope.

---

## Scope

- [x] `login` returns `{ success: false, error }` for unknown/wrong credentials instead of throwing
- [x] `/login?errorTitle=&errorMessage=` shows that copy on the form
- [x] Keep me logged in extends the session (server-fixed longer TTL)
- [x] Login alert uses the real error string
- [x] Seed non-harvest `recordCount: 1` (not `RECORD_TYPES.length`)
- [x] Mobile: closed sidebar does not steal clicks; breadcrumbs remain usable

---

## Implementation

### Part A — Auth

#### A1. `convex/auth.ts` + `convex/lib/session.ts`

- Shared `INVALID_CREDENTIALS_MESSAGE` in `authConstants.ts` (also listed in `AUTH_ERROR_MESSAGES`).
- `createSession(..., ttlKind)` — `"default"` is 30 minutes; `"persistent"` is 7 days when `keepMeLoggedIn` is true.
- `login` args: `keepMeLoggedIn: v.optional(v.boolean())`. Returns union of success (`publicUserValidator` + token) or `{ success: false, error }`. Still throw for unexpected failures.

#### A2. Client

- `AuthContext.login(email, password, keepMeLoggedIn)`.
- `LoginForm`: pass the checkbox; Alert `message={apiError}`; optional banner from query params.
- `login/page.tsx`: `useSearchParams` for `errorTitle` / `errorMessage` (Suspense).

### Part B — Seed

- `seedAccessEvent` default `recordCount` is `1`.
- `seedAccessEvents` passes `1` for non-harvest rows (`500` stays for mass access).

### Part C — Mobile overlay

- Closed mobile sidebar: `-translate-x-full` plus `pointer-events-none` / `invisible`; restore on `lg:` and when open.
- Header `z-99999` → `z-40` so it does not sit above the whole column. Backdrop stays `z-30` and only mounts when the mobile sidebar is open.

---

## Open questions

- [ ] Existing seeded `recordCount: 4` rows on a shared deployment stay wrong until re-seed.

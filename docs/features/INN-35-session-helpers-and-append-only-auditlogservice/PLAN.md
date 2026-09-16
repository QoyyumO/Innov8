# INN-35: Session helpers and append-only AuditLogService — Implementation Plan

**Git branch:** `INN-35-session-helpers-and-append-only-auditlogservice`  
**PR:** [#3](https://github.com/QoyyumO/Innov8/pull/3) (merged)

## Context

Shared plumbing for every later demo-path function (search → request → decision → view → break-glass). Session auth already exists in `convex/auth.ts`; domain APIs must reuse it rather than add a second identity path. Builds on INN-18 (`auditEvents`, `auditAction`) and the INN-19 seed. Owner: Adebare. Backend-first; no UI screens.

---

## Scope

- [x] `requireSession(ctx, token)` — throws on missing / unknown / expired token, missing user, or non-`active` account
- [x] `requireRole(user, roles)` plus role groups for clinician, security officer, and admin
- [x] Move `publicUser` out of `auth.ts` into a shared helper so domain functions can reuse it (never returns `hashedPassword`)
- [x] `convex/lib/services/auditLogService.ts` — `appendAuditEvent(db, event)`, insert-only into `auditEvents`
- [x] Log `UserLoggedIn` from the existing `login` mutation (with `sessionId`)
- [x] Document the client token pattern in `src/hooks/useAuth.ts`
- [x] Tests in `convex/session.test.ts` (vitest + convex-test; merged via INN-49)
- [x] No Next.js API routes; no public update/delete of audit rows

---

## Implementation

### Part A — Session helpers (`convex/lib/session.ts`)

#### A1. `requireSession`

`requireSession(ctx: { db: DatabaseReader }, token: string | undefined)` returns `{ user, session }` (`Doc<"users">`, `Doc<"sessions">`). Looks up `sessions.by_token`, checks `expiresAt`, loads the user, and rejects `accountStatus !== "active"`. Returning the session lets callers pass `sessionId` to the audit log. Error message stays generic ("Your session has expired…") for missing/expired tokens; suspended accounts get their own message.

#### A2. `createSession` returns `{ token, sessionId }`

Only caller is `login`. Needed so the login audit row can carry `sessionId`.

#### A3. `publicUser`

Moved from `convex/auth.ts`, typed with `Doc<"users">`. Same output shape as today so `AuthContext` and existing callers are unchanged.

`requireSessionUser` and `getCurrentUser` also reject non-active accounts since INN-47 (PR #4) merged.

### Part B — Roles (`convex/lib/roles.ts`)

#### B1. Role groups

`CLINICIAN_ROLES` (doctor, nurse, pharmacist, laboratory), `SECURITY_ROLES` (security_officer), `ADMIN_ROLES` (hospital_admin, system_admin).

#### B2. `requireRole(user, allowedRoles)`

Throws `"You do not have permission to perform this action"` when the user holds none of `allowedRoles`.

### Part C — Audit log (`convex/lib/services/auditLogService.ts`)

#### C1. `appendAuditEvent(db, { actorId?, sessionId?, action, entity, entityId?, details, createdAt? })`

`action` typed as `AuditAction` (closed enum from `convex/lib/domain.ts`); schema validation re-checks it on insert. `entity` trimmed and required via `assertNonEmptyString`. `createdAt` defaults to `Date.now()`; optional override lets the seed reuse the helper later. Only an insert function is exported.

#### C2. Login audit

`login` calls `appendAuditEvent` with `action: "UserLoggedIn"`, `entity: "sessions"`, `entityId: sessionId`, `details: { email }` after the session is created.

### Part D — Client pattern

#### D1. `src/hooks/useAuth.ts`

Doc comment showing `useQuery(api.x.y, sessionToken ? { token: sessionToken } : "skip")` and passing `token` to mutations, so later pages copy it.

---

## Open questions

- [x] Suspended users on `updateProfile` / `changePassword` — handled by INN-47 in `requireSessionUser`. Could still delegate to `requireSession` later to remove the duplicate check.
- [ ] Should `seedAccessEvent` in `convex/seed.ts` switch to `appendAuditEvent` in a follow-up?

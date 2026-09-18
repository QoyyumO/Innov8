# INN-60: Throw ConvexError so validation messages survive in production — Implementation Plan

**Git branch:** `INN-60-throw-convexerror-for-validation`

## Context

Production Convex redacts a plain `Error` to `"Server Error"`. Only `ConvexError` keeps a payload on the client. Validation paths throw `new Error(...)` today, so `findXInputError` helpers work in `npx convex dev` and fail after deploy. Login already returns `{ success: false, error }` (INN-54) for the same reason.

Owner: follow-up from the 2026-09-17 full-codebase review. No schema change.

---

## Scope

- [x] Shared `throwAppError` / `readAppError` with `{ code, message }`
- [x] User-facing validation throws `ConvexError` (session, roles, access, emergency, step-up, consent, alerts, auth mutations)
- [x] Client reads `error.data` (typed code); delete `findXInputError` helpers
- [x] Tests assert on `code`, not a substring of a wrapped message
- [x] Docs: validation errors survive a production deploy

---

## Implementation

### Part A — Shared error helper

#### A1. `convex/lib/appError.ts`

`throwAppError(code, message)` throws `new ConvexError({ code, message })`. `readAppError(error)` returns that payload from `ConvexError.data`. `isAuthAppError` matches `SESSION_EXPIRED` / `ACCOUNT_SUSPENDED` / `PERMISSION_DENIED` so queries that currently swallow auth `Error` messages still return empty/null.

Wording stays in existing `*Messages.ts` / `*Constants.ts`. Add a sibling `*_CODE` next to each `*_MESSAGE`. Delete `findAccessRequestInputError`, `findEmergencyInputError`, `findStepUpInputError`, `findConsentInputError`, and `isAuthErrorMessage`.

Leave internal programmer errors as `Error` (risk scoring, invariants, seed).

### Part B — Throw sites

#### B1. Services and session

Replace `throw new Error(MESSAGE)` in `accessControlService`, `emergencyAccessService`, `stepUpService`, `consentService`, `alertService`, `session.ts`, `roles.ts`, plus the matching throws in `emergency.ts`, `stepUp.ts`, `alerts.ts`, `audit.ts`, and `auth.ts` (reset / profile / password).

### Part C — Client and tests

#### C1. UI

`toUserFacingError` shows `readAppError(error).message` when a payload is present. Forms drop `findX*` substring matching. Account settings / reset password read `CURRENT_PASSWORD_INCORRECT` by code.

#### C2. Tests

`rejects.toThrow(MESSAGE)` for these paths becomes `rejects.toSatisfy((error) => isAppErrorCode(error, CODE))`. Remove the `findAccessRequestInputError` wrap tests.

#### C3. Docs

`README.md`, `AGENTS.md`, `Innov8_DDD.md`, `docs/README.md`, `.cursor/rules/innov8-next-tasks.mdc`.

---

## Open questions

- None. Ticket is explicit: structured `ConvexError`, typed code on the client, delete the find helpers.

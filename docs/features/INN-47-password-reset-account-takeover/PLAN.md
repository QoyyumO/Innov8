# INN-47: Security: password reset allows full account takeover — Implementation Plan

**Git branch:** `INN-47-password-reset-account-takeover`

## Context

Urgent security bug (Eno / code review). `requestPasswordReset` returns the hardcoded literal `"dev-reset-token"` in the mutation response, and `resetPassword` accepts that same value for any email. Anyone can take over any account, including users added after the demo seed. Related gap: `requireSessionUser` and `getCurrentUser` never re-check `accountStatus`, so a suspended user's session stays valid until the 5-hour TTL. There is no email provider in this repo; out-of-band delivery for the hackathon is Convex function logs, not the public API response.

---

## Scope

- [x] Random, single-use, expiring reset tokens stored hashed in Convex
- [x] Never return the plaintext token from `requestPasswordReset`
- [x] Generic success/error messages (no user enumeration)
- [x] `requireSessionUser` / `getCurrentUser` reject non-active accounts
- [x] Reset-password page so a token received out-of-band can be used in the UI
- [x] Remove the forgot-password "placeholder token" copy

---

## Implementation

### Part A — Schema and token helpers

#### A1. `passwordResetTokens` in `convex/schema.ts`

Fields: `userId` (`v.id("users")`), `tokenHash` (string), `expiresAt` (unix ms), optional `usedAt`. Indexes: `by_tokenHash`, `by_userId`. No `_creationTime` in indexes.

#### A2. Helpers

Reuse `generateSessionToken` from `convex/lib/session.ts`. SHA-256 hash the token for lookup (deterministic index; do not store plaintext). TTL: 15 minutes. Issuing a new token deletes that user's previous reset rows.

### Part B — Auth mutations

#### B1. `requestPasswordReset` (`convex/auth.ts`)

Always return `{ success: true, message: "If the account exists, reset instructions were sent." }`. If the user exists and is `active`, insert a hashed token and `console.log` the plaintext token for demo operators (`npx convex dev` / dashboard logs). Do not log for missing or suspended accounts.

#### B2. `resetPassword`

Lookup by `tokenHash`. Reject with `"Invalid or expired reset token"` when missing, expired, already used, email mismatch, or inactive account. Enforce min password length (same as `changePassword`). On success: patch `hashedPassword`, mark token used (or delete), `deleteAllUserSessions`. Never throw `"User not found"`.

### Part C — Session account status

#### C1. `convex/lib/session.ts` `requireSessionUser`

After loading the user, if `accountStatus !== "active"`, throw the same expired-session error as a missing session.

#### C2. `getCurrentUser`

Return `null` when the user is missing or not `active` so `AuthContext` clears the stored token.

### Part D — UI

#### D1. `/reset-password`

`(not-authenticated)` page + `_components/ResetPasswordForm.tsx` using `AuthPageLayout`, `api.auth.resetPassword`, email + token + new password. Prefill from `?email=` / `?token=` query params.

#### D2. Forgot-password copy

Drop the placeholder-token `devNote`. Point operators at Convex logs and link to `/reset-password`.

---

## Open questions

- [x] Email delivery: out of scope until a mailer exists; Convex logs are the ticket's "at minimum don't return it" path.

# INN-47: Security: password reset allows full account takeover — Implementation Plan

**Git branch:** `INN-47-password-reset-account-takeover`

## Context

Urgent security bug (Eno / code review). `requestPasswordReset` used to return the hardcoded literal `"dev-reset-token"` in the mutation response, and `resetPassword` accepted that value for any email. Anyone could take over any account, including users added after the demo seed. Related gap: `requireSessionUser` and `getCurrentUser` never re-checked `accountStatus`, so a suspended user's session stayed valid until TTL. Session TTL is now **30 minutes**. There is no email provider; demo operators issue a token via the internal Convex mutation (CLI), not logs or the public API.

---

## Scope

- [x] Random, single-use, expiring reset tokens stored hashed in Convex
- [x] Never return the plaintext token from `requestPasswordReset`
- [x] Generic success/error messages (no user enumeration)
- [x] `requireSessionUser` / `getCurrentUser` reject non-active accounts
- [x] Reset-password page so a token received out-of-band can be used in the UI
- [x] Remove the forgot-password "placeholder token" copy
- [x] Do not log plaintext tokens; 60s public-request cooldown; token checked before password policy
- [x] Session TTL 30 minutes

---

## Implementation

### Part A — Schema and token helpers

#### A1. `passwordResetTokens` in `convex/schema.ts`

Fields: `userId` (`v.id("users")`), `tokenHash` (string), `expiresAt` (unix ms), optional `usedAt`. Indexes: `by_tokenHash`, `by_userId`. No `_creationTime` in indexes.

#### A2. Helpers

Reuse `generateSessionToken` from `convex/lib/session.ts`. SHA-256 hash the token for lookup. TTL: 15 minutes. Shared constants in `convex/lib/authConstants.ts`. Public `requestPasswordReset` skips a new row if one was created for that user within 60 seconds.

### Part B — Auth mutations

#### B1. `requestPasswordReset` (`convex/auth.ts`)

Always return `{ success: true, message: "If the account exists, reset instructions were sent." }`. Never return or `console.log` the token. Demo: `npx convex run internal.auth.issuePasswordResetToken '{"email":"ibrahim@fmc.abuja.ng"}'`.

#### B2. `resetPassword`

Lookup by `tokenHash` first. Reject with `"Invalid or expired reset token"` when missing, expired, already used, email mismatch, or inactive account. Only then enforce min password length. On success: patch `hashedPassword`, mark token used, `deleteAllUserSessions`.

### Part C — Session account status

#### C1. `convex/lib/session.ts` `requireSessionUser`

After loading the user, if `accountStatus !== "active"`, throw the same expired-session error as a missing session.

#### C2. `getCurrentUser`

Return `null` when the user is missing or not `active` so `AuthContext` clears the stored token. New sessions last 30 minutes.

### Part D — UI

#### D1. `/reset-password`

`(not-authenticated)` page + `_components/ResetPasswordForm.tsx`. Prefill `?email=` only (never `?token=`). Clear the post-success redirect timer on unmount.

#### D2. Forgot-password copy

Point demo operators at the internal CLI mutation and `/reset-password`.

---

## Open questions

- [x] Email delivery: out of scope until a mailer exists; CLI `internal.auth.issuePasswordResetToken` is the demo out-of-band path.

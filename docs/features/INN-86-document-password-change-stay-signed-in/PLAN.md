# INN-86: Document password-change stay-signed-in vs log-out — Implementation Plan

**Git branch:** `INN-86-document-password-change-stay-signed-in`

## Context

QA: after a password change the current session stayed signed in; reset invalidates every session. INN-70: `changePassword` issues a fresh session so the caller stays signed in. Default: keep that behaviour and document it. Other sessions are already revoked.

Stacked on INN-84.

---

## Scope

- [x] Success copy on account settings: you stay signed in; other sessions ended
- [x] README + QA expected results: change vs reset
- [x] Do not stop issuing a fresh token

---

## Implementation

`account-settings/page.tsx`, README, `docs/qa/TEST-FINDINGS.md`.

---

## Open questions

- None.

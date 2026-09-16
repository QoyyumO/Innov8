# INN-51: Expire ALLOW decisions after a fixed window — Implementation Plan

**Git branch:** `INN-51-expire-allow-decisions`

## Context

An ALLOW decision released records forever: `resolveViewAuthorisation` only checked `outcome === "ALLOW"`, so a clinician could reopen a patient's records days later from the same request. Break-glass grants already expire after 15 minutes; allowed access should be time-boxed too. Filed as a follow-up to INN-40 / INN-41.

Decisions (agreed with Eno): the window is **24 hours** from `decidedAt`, and a refused attempt on an expired request is audited as a new `AccessExpired` event.

---

## Scope

- [x] `convex/lib/accessWindow.ts` (client-safe): `ALLOW_VALIDITY_MS` (24 h), `ALLOW_EXPIRED_REASON`, `allowedUntil`, `isAllowExpired`. Server-fixed; no client argument.
- [x] `resolveViewAuthorisation`: ALLOW authorises only while `now < decidedAt + ALLOW_VALIDITY_MS`; otherwise deny with `ALLOW_EXPIRED_REASON` and `expiredAt`. When a request has a grant, the grant still decides (unchanged).
- [x] `viewAuthorisedSummary`: return `allowedUntil` on authorised views and `expiredAt` on expired refusals; write `AccessExpired` for each expired attempt (not for BLOCK / VERIFY refusals).
- [x] `auditAction` gains `AccessExpired`; `/audit` labels it.
- [x] Request views expose `decision.allowedUntil` for ALLOW only.
- [x] UI: `/requests/[requestId]` shows "allowed until …", an expired state with **Request access again** (`/requests/new?publicId=…`), and no view button once expired; `/requests` shows an **Expired** badge.
- [x] Tests in `convex/records.test.ts` (fake timers for the boundary)
- [x] Docs updated

---

## Implementation

The window is measured from `accessDecisions.decidedAt`, which already exists, so no schema change or backfill is needed. Seeded ALLOW decisions older than 24 hours stop releasing records immediately.

The boundary is exclusive: at exactly `decidedAt + 24h` the request is expired (same convention as break-glass, where a grant is live only while `expiresAt > now`).

The client uses `useNow` to switch a page to the expired state while it is open. The server still enforces the window on every view.

---

## Open questions

- [ ] Should the dashboards count expired ALLOWs separately? Not needed for now.

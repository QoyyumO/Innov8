# INN-41: Break-glass emergency access API and /emergency UI — Implementation Plan

**Git branch:** `INN-41-break-glass-emergency-access` (stacked on `INN-39-harvest-block-security-alerts`, PR #11)

## Context

Demo step 7. When normal ALLOW (or consent) cannot complete, a clinician can use break-glass: they must give a justification, access is short-lived, every step is audited, and security sees it. INN-40's record exchange already honours a live grant on a request. Blocked by INN-35 (merged) and INN-40 (PR #10). Owner: Adebare.

---

## Scope

- [x] `convex/lib/services/emergencyAccessService.ts` — grant, revoke, expire, live-grant lookup
- [x] `convex/emergency.ts` — `grantEmergencyAccess`, `getActiveEmergencyAccess`, `revokeEmergencyAccess`, internal `expireEmergencyAccess`
- [x] Justification required (trimmed, 10–500 characters); TTL fixed on the server (15 minutes)
- [x] Audit `AccessRequested`, `EmergencyGranted`, `EmergencyExpired`, `EmergencyRevoked`
- [x] Security alert on every grant (`emergencyAccessId`, severity medium); visible and revocable on `/security`
- [x] Record exchange: when a request has any grant, the grant alone governs views (expired / revoked → refused)
- [x] `/emergency` page with `BreakGlassForm`; request detail and list show break-glass state
- [x] Tests in `convex/emergency.test.ts`
- [x] Docs updated

---

## Implementation

### Part A — Schema (small, additive)

- `emergencyAccess.by_requestId` index — lookup by request (record exchange, request views) instead of scanning an actor's grants.
- `emergencyAccess.by_actorId_and_patientId` — live-grant lookup for one clinician and patient.
- `auditAction` gains `EmergencyRevoked`. Adding a literal to the union is backward compatible with stored data.

`emergencyAccess.requestId` stays required, so every grant hangs off an access request.

### Part B — Emergency access service

`grantBreakGlass(ctx, { user, session, publicId, justification, recordTypes, requestId? })`

- Justification: trimmed, at least 10 and at most 500 characters.
- **Without `requestId`:** resolves the target like INN-37 (`resolveAccessTarget`) and inserts a new `accessRequests` row (purpose `emergency`, `recordCount` 1). **No risk decision is stored** — break-glass is the explicit override, and the grant is the decision. Audits `AccessRequested`.
- **With `requestId`:** the request must be the caller's own, for the same patient, one patient (`recordCount` 1), and not ALLOW (BLOCK or VERIFY). Harvest requests cannot be broken open.
- Refuses if the caller already has a live grant for that patient.
- Inserts `emergencyAccess` (`grantedAt` now, `expiresAt` now + 15 min), audits `EmergencyGranted`, raises a medium security alert ("Break-glass access granted", with requester, patient, justification, expiry) and audits `SecurityAlertRaised`, and schedules `internal.emergency.expireEmergencyAccess` at `expiresAt`.
- `revokeGrant` — sets `revokedAt`, audits `EmergencyRevoked`. Allowed for the grant holder, security officers, and admins; refused once expired or already revoked.
- `expireGrant` — scheduled; if not revoked, audits `EmergencyExpired` once. If the job runs before `expiresAt`, it reschedules instead of skipping forever. `revokedAt` is reserved for revocation.

### Part C — Record exchange (INN-40 overlap)

`resolveViewAuthorisation`: if the request has **any** grant, access is authorised only while one is live (`grantedBy: "emergency"`); otherwise an ALLOW decision authorises (`grantedBy: "decision"`). Lookup uses `by_requestId`. Break-glass requests have no decision, so after expiry or revocation the summary is refused.

### Part D — Public API (`convex/emergency.ts`)

- `grantEmergencyAccess(token?, publicId, justification, recordTypes, requestId?)` — clinicians only. Returns `{ grantId, requestId, publicId, targetFacility, recordTypes, grantedAt, expiresAt }`. No clinical content.
- `getActiveEmergencyAccess(token?, publicId)` — the caller's live grant for that patient or `null` (auth errors → `null`).
- `revokeEmergencyAccess(token?, grantId)`.
- `expireEmergencyAccess` — internal mutation.
- `getAccessRequest` / `listMyAccessRequests` (INN-37) gain an `emergency` field (`{ grantId, grantedAt, expiresAt, revokedAt, justification }` or `null`) so the UI can show break-glass state.
- `listSecurityAlerts` (INN-39) resolves emergency alerts through the grant and adds an `emergency` field; `AlertsTable` shows a break-glass badge, the justification, and **Revoke** while live.

### Part E — UI

- `emergency/page.tsx` — clinicians only. `BreakGlassForm`: public ID (prefilled from `?publicId=`, default PAT-002391), record types (all four by default), justification `TextArea`, "Access lasts 15 minutes" text, warning banner, and an acknowledgement checkbox that must be ticked. With `?requestId=`, the grant links to that denied request. On success: expiry time and **Open emergency records** → `/requests/[requestId]`. Shows an existing live grant for the patient instead of the form.
- `requests/[requestId]`: break-glass card (justification, expiry or "Ended", **End access now** for the holder); `AuthorisedSummary` offers **Use break-glass** on a denied one-patient request that does not already have a *live* grant (the link returns after expiry or revoke).
- `/requests` list: "Break-glass" badge when the request has a grant and no decision.

### Part F — Tests (`convex/emergency.test.ts`)

Grant without a request (new emergency request, no decision, audits, medium alert, scheduled expiry); justification rules; one live grant per patient; linking to own BLOCK / VERIFY request allowed, ALLOW / harvest / other clinician's / other patient's refused; non-clinicians and suspended users refused; summary visible while live and refused after expiry (fake timers + scheduled expiry → `EmergencyExpired` once) or revoke (`EmergencyRevoked`); an early expiry job reschedules so the audit is not dropped; revoke permissions (holder, security, admin yes; other clinician no); `getActiveEmergencyAccess`; security alert listing shows the emergency details.

---

## Open questions

- [ ] Should security be able to shorten or extend a grant? Not in scope; revoke only.

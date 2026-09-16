# INN-45: Consent service for cross-facility access — Implementation Plan

**Git branch:** `INN-45-consent-service`

## Context

Nothing checked patient consent: a clinician at one facility could be ALLOWed another facility's records on role and purpose alone. This should-have adds the minimum consent model, not a national registry. Emergency access must keep working without consent. Stacked on INN-53 (#20), which touches the same seed and docs; owner Adebare.

Decisions (agreed with Adebare):
- **Missing consent → VERIFY**, with an explicit reason. Nothing is released until consent is recorded (then step-up) or break-glass is used.
- **Scope:** every cross-facility, single-patient request **except purpose `emergency`** needs consent. Same-facility requests and bulk requests (already covered by the volume/harvest rules) don't.
- **Recording:** a clinician records the patient's consent for their own facility on the patient page, with a note. It lasts 30 days and is audited. Security officers and admins (scoped as in INN-52) can revoke it.
- **Demo:** the seed gives PAT-002391 an active consent for FMC Abuja, so Ibrahim's treatment request stays **ALLOW 8**. No other synthetic patient has consent.

---

## Scope

- [x] `consents` table (patient, granted-to facility, the facility holding the records, status, note, recorder, `grantedAt` / `expiresAt` / `revokedAt`) with indexes for lookup and reviewer lists
- [x] `accessDecisions.factors.consent`: `not_required` | `active` | `missing`
- [x] `convex/lib/consentConstants.ts` (client-safe) and `convex/lib/services/consentService.ts`: applies-rule, active lookup, record, revoke
- [x] Risk engine stays pure. `RiskInput.consent`: `missing` adds 35 points (floored at the VERIFY threshold) with a reason; `active` adds a reason only
- [x] `recordAccessRequest` evaluates consent before scoring
- [x] Step-up (INN-44) is refused while a consent-challenged request still has no consent; a password can't stand in for consent
- [x] `convex/consents.ts`: `getConsentStatus`, `recordPatientConsent`, `revokePatientConsent`, `listConsents`
- [x] Audit actions `ConsentRecorded` / `ConsentRevoked`; the audit facility index (INN-52) links consent events to both facilities
- [x] Seed: active demo consent for PAT-002391 at FMC Abuja (idempotent)
- [x] UI:
  - Consent panel on `/patients/[publicId]`: status, or a form to record consent.
  - "Consent on file" / "No patient consent" badges in the decision view.
  - Consent guidance on challenged requests.
  - "Patient consents" table with revoke on `/security`.
  - `/audit` labels for the new actions.
- [x] Tests: `convex/consents.test.ts` plus risk-engine cases; existing test worlds seed the demo consent
- [x] Docs updated

---

## Implementation

### Where consent is checked

`evaluateConsent` runs in `recordAccessRequest` (INN-37 / INN-39) before `scoreAccessRequest`, using the request's source facility and the patient. It returns `not_required` when the request is same-facility, purpose `emergency`, or covers more than one record. Otherwise it returns `active` if a live consent exists (status `active`, not expired), else `missing`.

### Scoring

Ibrahim's treatment request without consent scores 8 + 35 = **43 → VERIFY**. With consent it stays **8 → ALLOW**. Harvest requests skip the check, so they stay at exactly 94.

### Break-glass

Break-glass (INN-41) doesn't go through the risk engine, so consent never blocks it.

### Patient portal

Patient-facing grant/revoke is left for the patient portal (INN-46).

---

## Open questions

- [ ] Should consent eventually be per record type? Currently it covers all record types for the facility.

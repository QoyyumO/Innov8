# INN-77: Patient-owned consent grant and revoke — Implementation Plan

**Git branch:** `INN-77-patient-owned-consent`

## Context

FR-07: patients should view, grant, and revoke consent. Clinicians still record on `/patients/[publicId]`; reviewers still revoke on `/security`. Chioma cannot manage her own consents today (INN-46 left that out). No eID or SMS.

---

## Scope

- [x] Patient role: list consents for `users.patientId`, grant to a participating facility, revoke own live consents
- [x] Audit `ConsentRecorded` / `ConsentRevoked` with the patient as actor
- [x] Break-glass still works without consent
- [x] Seed still pre-grants FMC Abuja for PAT-002391
- [x] UI on the patient dashboard

---

## Implementation

### Part A — Backend

#### A1. Index
`consents.by_patientId_grantedAt` so the patient list never `.collect()`.

#### A2. Service + API
`recordOwnedConsent` / owner-mode `revokeConsent` in `consentService.ts`. Public: `listMyConsents`, `grantMyConsent`, `revokeMyConsent` in `consents.ts` via `requirePatientSession`. Clinician/reviewer APIs unchanged.

---

## Open questions

- None.

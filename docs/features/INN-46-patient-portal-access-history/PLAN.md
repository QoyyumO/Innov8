# INN-46: Patient portal view of own access history — Implementation Plan

**Git branch:** `INN-46-patient-portal-access-history`

## Context

Should-have after the 7-step demo. Chioma already has a patient-role demo login (`chioma@patient.innov8.ng`); `PatientDashboard.tsx` is now live. Not required to prove clinician access. Linear assignee is Henry; INN-42 (audit trail) was the blocker and is done on `main`. Related to INN-45 (patient-facing consent stays out of this ticket).

---

## Scope

- [x] Explicit session→patient link: optional `users.patientId` (no matching on name/email)
- [x] Query: the signed-in patient’s identity, home facility, and recent `auditEvents` that name them (bounded; no `.collect()`)
- [x] Never take a client `patientId` / `publicId`. Patient role only; clinician sessions get `null`
- [x] Replace dummy `PatientDashboard` with live PAT-002391 data for the Chioma login
- [x] Access-history list: who requested / viewed her records
- [x] Tests: Chioma sees only her metadata/history; Ibrahim does not
- [x] Docs updated

---

## Implementation

### Part A — Link and indexes

#### A1. `users.patientId`

Optional `v.id("patients")` on `users` (no extra index; the portal reads `user.patientId` from the session). Seed sets it only for Chioma when PAT-002391 is upserted (`patchCountedUser`). Login `ensureDemoUsers` does not guess a patient. Wipe unsets the link before deleting patients.

#### A2. `auditEvents.patientId`

Optional `v.id("patients")` plus `by_patientId_createdAt`. `appendAuditEvent` sets it via `resolveAuditPatientId` (public id in details, related request / consent / grant).

### Part B — Query

#### B1. `getPatientDashboard` in `convex/dashboards.ts`

Args: `{ token }` only. `requireSession` + `requireRole(["patient"])`. Auth / wrong role / missing `users.patientId` → `null`.

Returns (no clinical sections): `publicId`, profile first/last name, home facility `{ code, name, city }`, `recentEvents` plus `isHistoryCapped` (cap `PATIENT_HISTORY_LIMIT` = 20). Indexed `auditEvents.by_patientId_createdAt` desc.

### Part C — UI

`PatientDashboard.tsx`: `useQuery(api.dashboards.getPatientDashboard)`. Show identity + home facility. Fill “Who accessed your records” from `recentEvents`.

### Part D — Tests

`convex/dashboards.test.ts`: seed Chioma linked to PAT-002391; she receives that publicId and events that reference her; Ibrahim’s token returns `null`; another patient’s events stay out. `convex/seed.test.ts`: seed links Chioma to PAT-002391.

---

## Open questions

- [ ] Patient-facing consent grant/revoke is INN-45 leftover, not this ticket.

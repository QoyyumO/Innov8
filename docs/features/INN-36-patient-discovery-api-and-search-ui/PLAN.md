# INN-36: Patient discovery API and search UI (existence only) — Implementation Plan

**Git branch:** `INN-36-patient-discovery-api-and-search-ui`

## Context

Demo step 2: a signed-in clinician (Dr. Ibrahim) identifies a patient across facilities and sees **identity + record existence**, never `clinicalSummaries` contents. Blocker INN-35 (session helpers + `AuditLogService`) is on `main`. Unblocks INN-37 (purpose-based access request). Synthetic data only (`PAT-002391` / Chioma Okonkwo, home FMC Lagos).

---

## Scope

- [ ] `convex/lib/services/patientDiscoveryService.ts` — lookup by `publicId` / bounded `searchName`; load `recordIndexes` existence only
- [ ] `convex/patients.ts` — public `searchPatients` and `getPatientDiscovery`; audit `PatientSearched` on successful lookup
- [ ] Omit allergies, medications, diagnoses, medicalSummary (and other clinical fields) from returns
- [ ] `/patients` search UI (hint `PAT-002391`) — name, publicId, home facility
- [ ] `/patients/[publicId]` discovery — “Records exist at …” + record-type badges + Request access CTA (form is INN-37)
- [ ] `_components/PatientSearchForm.tsx` and `RecordExistenceList.tsx`
- [ ] `/patients` stops 404ing (sidebar already links there)

---

## Implementation

### Part A — Discovery service (`convex/lib/services/patientDiscoveryService.ts`)

#### A1. Indexed lookup (no 10k scan)

- `publicId`: `patients.by_publicId` (normalize `PAT-######`).
- Name fragment: `patients.by_searchName` prefix range + `.take(20)` (seed stores `searchName` as lowercase `"chioma okonkwo"` via `normalizeSearchName`).
- Never `.collect()` or `.filter()` the patients table.

#### A2. Existence projection

Load `recordIndexes` with `by_patientId`. For each index, resolve `facilities` and return `{ code, name, recordTypes[] }` only. Do not read `clinicalSummaries`.

Search hits: `{ publicId, profile, homeFacility: { code, name } }`.

---

### Part B — Public API (`convex/patients.ts`)

Convex **queries cannot insert**. Ticket copy says “query”; both endpoints are **mutations** so they can call `appendAuditEvent` in the same transaction after a successful lookup.

#### B1. `searchPatients`

Args: `token` (optional string), `query` (publicId or name fragment). `requireSession` first — missing/bad token throws (no patient data). Empty/no-match returns `[]` and does **not** audit.

#### B2. `getPatientDiscovery`

Args: `token`, `publicId`. Returns identity, home facility, and per-facility index, or `null` if unknown. Audit only when a patient is found.

#### B3. Audit

`appendAuditEvent`: `action: "PatientSearched"`, `entity: "patients"`, `entityId` = publicId, `actorId` / `sessionId` from `requireSession`. `returns` validators omit clinical fields.

#### B4. Tests (`convex/patients.test.ts`)

Seed Lagos + PAT-002391 + index + a clinical summary. Ibrahim login can search by id and name prefix. Payload has no summary/allergies/meds/diagnoses. Bad token throws. Successful search writes `PatientSearched`.

---

### Part C — Search UI

#### C1. `src/app/(authenticated)/patients/page.tsx`

`PageBreadCrumb`, existing `Input` / `Button` / `Alert`. Hint `PAT-002391`. Results: name, publicId, home facility — links to `/patients/[publicId]`.

#### C2. `src/app/(authenticated)/patients/_components/PatientSearchForm.tsx`

`"use client"`. `useAuth().sessionToken` + `useMutation(api.patients.searchPatients)`. Inner async submit (not an async effect). Skip/disable without a token.

---

### Part D — Discovery UI

#### D1. `src/app/(authenticated)/patients/[publicId]/page.tsx`

Identity + home facility. `RecordExistenceList`. CTA **Request access** is present but does not open a purpose form (INN-37).

#### D2. `RecordExistenceList.tsx`

Copy like “Records exist at FMC Lagos” plus badges for `medical_summary` / `allergies` / `medications` / `diagnoses`. Never render summary text.

---

## Atomic commits

1. Plan (`chore`)
2. Discovery service (`feat`)
3. Public mutations + tests (`feat`)
4. Search page + form (`feat`)
5. Discovery page + existence list (`feat`)

---

## Open questions

- [x] Ticket says Convex queries, but audit requires writes — resolved: public mutations with the same names.
- [ ] Should `requireRole(user, CLINICIAN_ROLES)` apply, or is any active session enough? Ticket only requires signed-in Ibrahim — start with `requireSession` only.

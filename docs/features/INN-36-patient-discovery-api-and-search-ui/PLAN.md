# INN-36: Patient discovery API and search UI (existence only) — Implementation Plan

**Git branch:** `INN-36-patient-discovery-api-and-search-ui`

## Context

Demo step 2: a signed-in clinician (Dr. Ibrahim) identifies a patient across facilities and sees **identity + record existence**, never `clinicalSummaries` contents. Blocker INN-35 (session helpers + `AuditLogService`) is on `main`. Unblocks INN-37 (purpose-based access request). Synthetic data only (`PAT-002391` / Chioma Okonkwo, home FMC Lagos).

---

## Scope

- [x] `convex/lib/services/patientDiscoveryService.ts` — lookup by `publicId` / bounded `searchName`; load `recordIndexes` existence only
- [x] `convex/patients.ts` — `searchPatients` mutation (audited); `getPatientDiscovery` query (no audit); `requireRole(CLINICIAN_ROLES)`
- [x] Omit allergies, medications, diagnoses, medicalSummary (and other clinical fields) from returns
- [x] `/patients` search UI (hint `PAT-002391`) — name, publicId, home facility
- [x] `/patients/[publicId]` discovery — “Records exist at …” + record-type badges + Request access CTA (form is INN-37)
- [x] `_components/PatientSearchForm.tsx` and `RecordExistenceList.tsx`
- [x] `/patients` stops 404ing; sidebar Patient search is clinician-only

---

## Implementation

### Part A — Discovery service (`convex/lib/services/patientDiscoveryService.ts`)

#### A1. Indexed lookup (no 10k scan)

- `publicId`: `patients.by_publicId` (normalize `PAT-######`).
- Name fragment: `patients.by_searchName` prefix range + `.take(20)` after at least 3 characters (seed stores `searchName` as lowercase `"chioma okonkwo"` via `normalizeSearchName`).
- Never `.collect()` or `.filter()` the patients table.

#### A2. Existence projection

Load `recordIndexes` with `by_patientId`. For each index, resolve `facilities` and return `{ code, name, recordTypes[] }` only. Do not read `clinicalSummaries`.

Search hits: `{ publicId, profile, homeFacility: { code, name } }`.

---

### Part B — Public API (`convex/patients.ts`)

Convex **queries cannot insert**. `searchPatients` is a **mutation** so it can append `PatientSearched` in the same transaction. `getPatientDiscovery` is a **query** so the detail page can use `useQuery` without double-auditing on React Strict Mode remounts.

Opening `/patients/[publicId]` without a prior search is **not** audited. Search (form submit) is.

#### B1. `searchPatients` (mutation)

Args: `token` (optional string), `query` (publicId or name fragment). `requireSession` then `requireRole(user, CLINICIAN_ROLES)`. Missing/bad token throws. Empty/no-match/`query` shorter than 3 letters (when not a public ID) returns `[]` and does **not** audit.

#### B2. `getPatientDiscovery` (query)

Args: `token`, `publicId`. Returns identity, home facility, and per-facility index, or `null` if unknown, unauthenticated, or not a clinician (no existence leak). Known auth errors return `null`; any other error is rethrown. Does **not** write audit rows.

#### B3. Audit

`searchPatients` only: `appendAuditEvent` with `action: "PatientSearched"`, `entity: "patients"`, `entityId` = publicId, `actorId` / `sessionId` from `requireSession`. `returns` validators omit clinical fields.

#### B4. Tests (`convex/patients.test.ts`)

Seed Lagos + PAT-002391 + index + a clinical summary. Ibrahim login can search by id and name prefix (≥3 letters). Payload has no summary/allergies/meds/diagnoses. Bad token throws on search and returns null on discovery. Patient role is denied. Successful search writes `PatientSearched`.

---

### Part C — Search UI

#### C1. `src/app/(authenticated)/patients/page.tsx`

`PageBreadCrumb`, existing `Input` / `Button` / `Alert`. Hint `PAT-002391`. Empty state: public ID or at least 3 letters of the given name (not family name). Results: name, publicId, home facility — links to `/patients/[publicId]`.

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
3. `searchPatients` mutation + `getPatientDiscovery` query + tests (`feat`)
4. Search page + form (`feat`)
5. Discovery page + existence list (`feat`)

---

## Open questions

- [x] Ticket says Convex queries, but audit requires writes — resolved: `searchPatients` is a mutation; `getPatientDiscovery` is a query (no audit on the detail page).
- [x] `requireRole(user, CLINICIAN_ROLES)` — applied. Sidebar hides Patient search for non-clinicians.

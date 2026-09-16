# INN-37: Purpose-based access request API and request UI — Implementation Plan

**Git branch:** `INN-37-access-request-api-and-ui` (stacked on `INN-38-risk-scoring-service` until PR #8 merges)

## Context

Demo steps 3–4. A signed-in clinician asks for another facility's records for a stated purpose; the request is stored, scored with INN-38's `scoreAccessRequest`, and decided (ALLOW / VERIFY / BLOCK) with visible reasons. Every later view (INN-40 summary, INN-39 harvest, INN-41 break-glass) hangs off this request. Blocked by INN-35 (merged), INN-36 (merged), INN-38 (PR #8). Owner: Adebare.

---

## Scope

- [x] `convex/lib/services/accessControlService.ts` — resolve patient, source facility, target facility; validate record types
- [x] `convex/accessRequests.ts` — `createAccessRequest` (mutation), `listMyAccessRequests` (paginated query), `getAccessRequest` (query)
- [x] Audit `AccessRequested` + `AccessAllowed` / `AccessChallenged` / `AccessBlocked`
- [x] No clinical fields in any return value
- [x] `/requests` list, `/requests/new` form, `/requests/[requestId]` decision view
- [x] `_components/AccessRequestForm.tsx`, `DecisionResult.tsx`; shared record-type / purpose / outcome labels
- [x] Patient discovery "Request access" button opens `/requests/new?publicId=…`
- [x] Tests in `convex/accessRequests.test.ts`
- [x] Docs updated

Out of scope: security alerts on BLOCK (INN-39), clinical summary (INN-40), VERIFY step-up (INN-44).

---

## Implementation

### Part A — Access control service

#### A1. `resolveAccessTarget(db, user, publicId, recordTypes)`

- Patient via `patients.by_publicId` (normalised `PAT-######`); unknown → "Patient not found".
- **Source facility:** `user.facilityId`; if missing (demo users before seeding), `facilities.by_name` on `user.hospital`; none → "Your account is not linked to a participating facility".
- **Target facility:** the record index at the patient's home facility (`recordIndexes.by_patientId_facilityId`), else the first index by `by_patientId` (bounded `.take`). No index → "No records are indexed for this patient".
- Requested record types must be held at the target; otherwise "Records not held at <facility>: …".
- Returns patient, source facility id, target facility `{ _id, code, name }`, `sameHospital`.

Session (`requireSession`, rejects suspended accounts) and role (`requireRole(user, CLINICIAN_ROLES)`) checks happen first in every function.

### Part B — Public API (`convex/accessRequests.ts`)

#### B1. `createAccessRequest` (mutation)

Args: `token?`, `publicId`, `purpose` (shared validator), `recordTypes` (shared validator array), `recordCount?` (default 1, whole number 1–10,000). Record types are de-duplicated and must be non-empty.

Steps: insert `accessRequests` (actor, session, patient, facilities, purpose, types, count, `requestedAt`) → `scoreAccessRequest` with the actor's `normalAccessHours` / `normalPatientVolume` → insert `accessDecisions` (score, outcome, reasons, factors) → `appendAuditEvent` ×2.

Returns `{ requestId, publicId, targetFacility, purpose, recordTypes, recordCount, outcome, riskScore, reasons, requestedAt }`.

#### B2. `listMyAccessRequests` (query, paginated)

`accessRequests.by_actorId_requestedAt`, newest first, `.paginate()`. Each row joins its decision (`accessDecisions.by_requestId`), patient `publicId`, and target facility name. Auth errors return an empty, finished page so the list does not crash on session expiry.

#### B3. `getAccessRequest` (query)

Args `token?`, `requestId` (string, normalised with `ctx.db.normalizeId`). Visible to the requesting clinician, security officers, and admins; everyone else (and bad ids / auth errors) gets `null`.

### Part C — UI (`src/app/(authenticated)/requests/`)

- `page.tsx` — table of my requests (time, patient, purpose, record types, outcome badge, risk) with "Load more"; "New request" button; non-clinicians see an explanatory empty state.
- `new/page.tsx` — `Suspense` wrapper; `AccessRequestForm` prefilled from `?publicId=` (PAT-002391 hint), purpose radios, record-type checkboxes (all four checked by default). Submit shows `DecisionResult` inline with a link to the saved request.
- `[requestId]/page.tsx` — `DecisionResult` for a saved request.
- `DecisionResult` — outcome badge, `score/100`, every reason as a list item, factor chips (role, purpose, facility, record count). No clinical content.
- Labels for record types, purposes, and outcomes live in `src/app/(authenticated)/_components/accessLabels.ts` and are reused by `RecordExistenceList`.
- Patient discovery page: "Request access" becomes an active button to `/requests/new?publicId=…`.

Built only from existing components: `ComponentCard`, `PageBreadCrumb`, `Button`, `Alert`, `Badge`, `Radio`, `Checkbox`, `Input`, `Label`, `Table`, `EmptyState`, `Loading`.

### Part D — Tests (`convex/accessRequests.test.ts`)

Ibrahim → PAT-002391 treatment → ALLOW 8 with reasons; stored request/decision fields and factors; two audit rows; harvest (`recordCount: 500`) → BLOCK 94; facility fallback by hospital name; non-clinician and suspended users rejected; unknown patient, record types not held, empty types, bad counts; duplicate types collapsed; list is own-only, newest first, paginated; `getAccessRequest` visibility (owner, other clinician, security officer, bad id); no clinical leak anywhere.

---

## Open questions

- [ ] Should a BLOCK here also raise the security alert, or leave that entirely to INN-39? (Plan: INN-39.)

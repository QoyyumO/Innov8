# INN-40: Authorised clinical summary after ALLOW — Implementation Plan

**Git branch:** `INN-40-authorised-clinical-summary` (stacked on `INN-37-access-request-api-and-ui` until PRs #8 and #9 merge)

## Context

Demo step 5. After an ALLOW decision (or a live emergency grant on the same request), the requesting clinician can open **only the record types they asked for**, from the **target facility only**. BLOCK and VERIFY release nothing. Every successful view is audited as `RecordViewed`. Blocked by INN-37 (PR #9). Unblocks INN-41. Owner: Adebare.

---

## Scope

- [x] `convex/lib/services/recordExchangeService.ts` — authorisation check + field filtering
- [x] `convex/records.ts` — `viewAuthorisedSummary` mutation (audited)
- [x] `RecordViewed` audit on successful reads only
- [x] No clinical text for BLOCK / VERIFY / other users
- [x] `AuthorisedSummary.tsx` on `/requests/[requestId]` — one section per requested record type
- [x] Tests in `convex/records.test.ts`
- [x] Docs updated

---

## Implementation

### Part A — Record exchange service

#### A1. `resolveViewAuthorisation(db, request, now)`

- Decision via `accessDecisions.by_requestId`.
- `ALLOW` → authorised by `"decision"`.
- Otherwise, an emergency grant for **this request** (`emergencyAccess.by_actorId`, bounded `.take`, `requestId` match, not revoked, `expiresAt > now`) → authorised by `"emergency"` with its expiry. INN-41 creates these grants.
- Otherwise denied with the decision's outcome, score, and reasons.

#### A2. `loadAuthorisedSections(db, request)`

`clinicalSummaries.by_patientId_facilityId` with the request's **target** facility. Builds only the requested fields:

| Record type | Field |
| --- | --- |
| `medical_summary` | `medicalSummary` |
| `allergies` | `allergies` |
| `medications` | `medications` |
| `diagnoses` | `diagnoses` |

`conditions` and every other facility's summary are never read into the response.

### Part B — Public API (`convex/records.ts`)

`viewAuthorisedSummary` is a **mutation** because a Convex query cannot write the `RecordViewed` audit row. The UI calls it from an explicit "View authorised records" button, so a view is a deliberate, audited action (and React Strict Mode cannot double-log it).

Args `token?`, `requestId` (string, normalised). Clinicians only; only the original requester. Returns a tagged union:

- `{ status: "authorised", grantedBy, emergencyExpiresAt?, publicId, facility, recordTypes, sections, summaryUpdatedAt }`
- `{ status: "unavailable", publicId, facility }` — authorised but no summary at the target facility
- `{ status: "denied", outcome, riskScore, reasons }` — no clinical content
- `null` — unknown id or someone else's request

Audit `RecordViewed` (`entity: "clinicalSummaries"`, details: request id, patient, facility, record types, grantedBy) only for `authorised`.

### Part C — UI

- `requests/_components/AuthorisedSummary.tsx` — on the request detail page, for the requester only:
  - ALLOW: "View authorised records" button → sections (Medical summary text; Allergies / Medications / Diagnoses as lists), facility name, "View recorded in the audit trail" note.
  - Emergency: same, with a warning banner and expiry time.
  - Denied: "No clinical content is released for this request."
- Security officers and admins keep seeing the decision only.

### Part D — Tests (`convex/records.test.ts`)

ALLOW shows exactly the requested sections from the target facility (and not another facility's summary); changing requested types changes sections; BLOCK and VERIFY are denied with no leak and no audit; another clinician, security officer, and anonymous callers get null / errors; `RecordViewed` written once per successful view with the session id; emergency grant on a VERIFY/BLOCK request authorises until expiry or revocation; grant for a different request does not; missing summary → `unavailable`.

---

## Open questions

- [ ] Should an ALLOW decision expire (e.g. 24 hours)? Not specified; views are allowed while the decision stands.

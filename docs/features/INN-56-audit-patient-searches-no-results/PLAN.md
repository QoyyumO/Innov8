# INN-56: Audit patient searches that return no results — Implementation Plan

**Git branch:** `INN-56-audit-patient-searches-no-results`

## Context

Found in the 2026-09-17 full-codebase review. `searchPatients` only writes `PatientSearched` when there is at least one hit, so probing unknown public IDs or names leaves no trail. Enumeration is the reconnaissance the audit log is meant to catch. No blockers. Assignee is Oyinlola.

---

## Scope

- [x] Always append `PatientSearched` for a search that was run, including zero hits
- [x] Keep `resultCount`; `publicIds` is `[]` on a miss
- [x] `details.query` is the trimmed query that was run
- [x] `entityId` is unset on a miss (do not use a fake first hit)
- [x] Test in `convex/patients.test.ts` for zero results
- [x] Do not change `getPatientDiscovery` (still unaudited by design)

---

## Implementation

### Part A — `convex/patients.ts`

Drop the `results.length > 0` guard. After `findPatientsByQuery`, always `appendAuditEvent` when the trimmed query is non-empty (empty/whitespace is not a search). Details: `query` trimmed, `resultCount`, `publicIds` from hits (empty array on miss). `entityId`: first hit’s `publicId` when present, otherwise omit.

Keep the existing skip for 1–2 character **name** prefixes that never query the index? Ticket says always append. Treat any non-empty `searchPatients` call as a search, including short prefixes and unknown `PAT-000001`, so enumeration is visible. Empty string still does not audit.

### Part B — Tests

`convex/patients.test.ts`: Ibrahim searches a public ID / name that does not exist → one `PatientSearched` with `resultCount: 0`, `publicIds: []`, `details.query` trimmed, no `entityId`. Update the short-prefix test if those calls now audit. Hits still audit as today (`entityId` = PAT-002391). Discovery of an unknown id still does not write `PatientSearched`.

---

## Open questions

- [ ] Empty/whitespace-only query: not audited (not a search that was run).

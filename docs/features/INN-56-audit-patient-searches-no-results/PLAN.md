# INN-56: Audit patient searches that return no results — Implementation Plan

**Git branch:** `INN-56-audit-patient-searches-no-results`

## Context

Found in the 2026-09-17 full-codebase review. `searchPatients` only writes `PatientSearched` when there is at least one hit, so probing unknown public IDs or names leaves no trail. Enumeration is the reconnaissance the audit log is meant to catch. No blockers.

The first pass (PR #24) read this as "audit every non-empty query". That over-reached: a 1-2 character name prefix is rejected by `findPatientsByQuery` before it touches an index, so nothing was searched and there is nothing to record. PR #24 also rewrote the test that asserted this to bless the new behaviour. This pass narrows the gate to "a lookup actually ran", per the refinement on the ticket. Assignee is Adebare.

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

### Part A — `convex/lib/searchLimits.ts`

The "did a lookup run?" test was hand-rolled in three places — the service, the mutation, and `PatientSearchForm` — and had already drifted. Make it one exported predicate:

- `normalizeSearchQuery` moves here from `patientDiscoveryService` (pure, client-safe, and the length check must run on the *normalised* string).
- `isSearchableQuery(query)`: false for empty/whitespace; true for a public ID; otherwise true only when the normalised name is at least `NAME_PREFIX_MIN_LENGTH`.

`findPatientsByQuery` and `PatientSearchForm` both consume it, so the three copies become one. The form keeps its two distinct messages — empty is still "enter something", short is still "at least 3 letters".

### Part B — `convex/patients.ts`

Gate `appendAuditEvent` on `isSearchableQuery`, not on `trimmedQuery !== ""`. A query that reached an index is audited hit or miss; one rejected before any lookup is not. `entityId` is `results[0]?.publicId`, so it is unset on a miss. Details keep `query` (trimmed), `resultCount`, and `publicIds` (`[]` on a miss).

### Part C — Tests

`convex/patients.test.ts`:

- Restore the assertion PR #24 inverted: `"c"` and `"ch"` return nothing and write **no** audit row.
- Add the name-prefix miss (`"  zzzzzz  "`) — a query long enough to walk the index and find nothing → one row, `resultCount: 0`, `publicIds: []`, no `entityId`.
- The public-ID miss (`PAT-000001`) and whitespace-only cases from PR #24 already cover their paths and stay as they are.

---

## Open questions

- [x] Empty/whitespace-only query: not audited (not a search that was run).
- [x] Sub-minimum name prefix: not audited either — same reason, no lookup ran.

# INN-80: Additional record types (labs / imaging existence) — Implementation Plan

**Git branch:** `INN-80-lab-results-existence`

## Context

Deep dive §4 lists more types than the MVP four. Ticket: add **at most one** extra type federation can hold per facility (`lab_results`) on the record index and authorised summary. Existence-only until ALLOW. Do not build imaging PACS, notes editor, or a national EMR.

---

## Scope

- [x] Add `lab_results` to `RecordType`
- [x] Index + optional `labResults` on `clinicalSummaries`; never return `conditions`
- [x] Authorised summary copies lab results only when requested and ALLOW (or live break-glass)
- [x] Laboratory role may request `lab_results` (and diagnoses); doctors/nurses get the new type; harvest stays the original four
- [x] Seed synthetic lab lines for PAT-002391; discovery still has no clinical payload

---

## Implementation

`convex/lib/domain.ts`, `schema.ts`, `recordExchangeService.ts`, `recordTypeAccess.ts`, seed, request/summary UI labels.

---

## Open questions

- None.

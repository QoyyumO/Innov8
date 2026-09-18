# INN-81: Audited clinical write after ALLOW (FR-15) — not an EMR — Implementation Plan

**Git branch:** `INN-81-audited-clinical-note-after-allow`

## Context

FR-15 / §6 allow doctors to write clinical information. Innov8 is an access layer, not an EMR. Ticket: if we do anything, a tightly scoped, audited append of a synthetic note **after ALLOW** (who, what, when, originating facility), still no full chart editing.

Stacked on INN-80.

---

## Scope

- [x] Append-only `clinicalNotes` row linked to an ALLOW request (doctors only)
- [x] Audit `ClinicalNoteAppended` with actor, note id, time, originating facility — not an EMR editor
- [x] Refuse VERIFY/BLOCK, expired ALLOW, break-glass-only grants, other roles, other people's requests
- [x] UI on the request page after ALLOW; no chart rewrite of `clinicalSummaries`

---

## Implementation

`convex/clinicalNotes.ts` + `clinicalNoteService.ts`. Reuse `resolveViewAuthorisation` (`grantedBy === "decision"`).

---

## Open questions

- None.

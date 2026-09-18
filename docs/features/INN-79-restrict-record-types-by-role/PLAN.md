# INN-79: Restrict record types by clinician role — Implementation Plan

**Git branch:** `INN-79-restrict-record-types-by-role`

## Context

Deep dive §6: pharmacist → medication-related; laboratory → laboratory-related. Dashboards already say that; `createAccessRequest` still allows any clinician all four types. Doctors/nurses keep the current four for the Track C treatment demo. Do not invent a full EMR.

Stacked on INN-78.

---

## Scope

- [x] Server allow-list per role (pharmacist: medications + allergies; laboratory: diagnoses until a lab type exists)
- [x] UI hides types the role cannot request
- [x] Doctors/nurses keep all four types
- [x] Tests: Chinedu/Aisha refused for out-of-role types; Fatima still allowed all four

---

## Implementation

`convex/lib/recordTypeAccess.ts` (client-safe) + assert in `recordAccessRequest` / harvest / new emergency grants.

---

## Open questions

- None.

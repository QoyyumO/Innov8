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
- [x] Tests: Fatima may request all four; Chinedu/Aisha refused for out-of-role types
- [x] Harvest demo (`simulateBulkHarvest`) still uses the four types; it is a volume attack, not a pharmacist chart request

---

## Implementation

`convex/lib/recordTypeAccess.ts` (client-safe). Purpose-based `recordAccessRequest` and new (unlinked) break-glass grants assert the allow-list after types are normalised. Harvest sets `skipRoleRecordTypeCheck`. The request and break-glass forms never fall back to all four types while roles are still loading.

---

## Open questions

- None.

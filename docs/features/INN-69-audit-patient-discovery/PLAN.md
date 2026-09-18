# INN-69: getPatientDiscovery is an unaudited identity lookup — Implementation Plan

**Git branch:** `INN-69-audit-patient-discovery`

## Context

INN-56 audits `searchPatients`. `getPatientDiscovery` is still a query: same `by_publicId` lookup, richer payload, no audit. Walking public IDs on `/patients/[publicId]` is the enumeration hole. Stacked on INN-67.

---

## Scope

- [x] Keep `getPatientDiscovery` as a query for the detail page
- [x] Add `recordPatientDiscovery` mutation that writes `PatientDiscovered` (hit or miss)
- [x] Per-session + publicId dedup so Strict Mode remounts do not double-write
- [x] Detail page records once on mount
- [x] Replace the "does not audit" test
- [x] Docs regain the enumeration claim

---

## Implementation

### Part A — schema and action

`PatientDiscovered` on `auditAction`. Index `auditEvents.by_sessionId_action_entityId`.

### Part B — mutation + UI

`convex/patients.ts`, `src/app/(authenticated)/patients/[publicId]/page.tsx`.

### Part C — tests and labels

`convex/patients.test.ts`, `auditLabels.ts`.

---

## Open questions

- None. Companion mutation + server dedup (option 2 plus the Strict Mode requirement).

# INN-73: Paid-plan runbook for full §14 seed volumes — Implementation Plan

**Git branch:** `INN-73-paid-plan-section-14-seed-runbook`

## Context

INN-55 shrunk the operational seed so the Convex free plan does not fill up. Judges should see the Lagos→Abuja story, not 10k/100k counts. This ticket documents how to restore §14 volumes on a **paid or throwaway** deployment only.

Stacked on INN-72.

---

## Scope

- [x] Keep demo defaults 24 / 200+PAT-002391 / 200
- [x] Named §14 constants (not used as defaults)
- [x] Runbook in `convex/README-seeding.md` + pointer in root README
- [x] `seedPatientsBatch` can forward event/worker counts when chaining events

---

## Implementation

### Part A — `convex/lib/synthetic.ts` constants

### Part B — runbook + optional seed args

---

## Open questions

- None. Never run §14 on the shared free deployment.

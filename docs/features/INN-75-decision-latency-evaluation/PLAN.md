# INN-75: Measure decision latency and §15 evaluation numbers — Implementation Plan

**Git branch:** `INN-75-decision-latency-evaluation`

## Context

NFR-04: 95% of **normal** access decisions inside 1 second **in the decision engine** (exclude network). §15 wants honest evaluation numbers. Scoring is already synchronous; this records evidence.

Stacked on INN-74.

---

## Scope

- [x] Time `scoreAccessRequest` for normal, harvest, and VERIFY (missing-consent) cases
- [x] p50/p95 in `docs/features/INN-75-decision-latency-evaluation/EVALUATION.md`
- [x] Harvest detection, false-positive notes, emergency still separate
- [x] Label as target + measurement, not a production SLO
- [x] No metrics product

---

## Implementation

`convex/lib/decisionEvaluation.ts` + `convex/decisionEvaluation.test.ts`.

---

## Open questions

- None.

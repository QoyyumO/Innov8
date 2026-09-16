# INN-38: Risk scoring service (ALLOW ~8, harvest BLOCK ~94) — Implementation Plan

**Git branch:** `INN-38-risk-scoring-service`

## Context

Explainable risk for every record-access request, used by `createAccessRequest` (INN-37) and the harvest path (INN-39). Demo numbers are a product invariant: Ibrahim (doctor, FMC Abuja) requesting PAT-002391 (FMC Lagos) for treatment scores **8 → ALLOW**; a 500-record harvest scores **94 → BLOCK**. Scoring is pure — no `ctx.db` reads or writes; the caller persists `accessDecisions`. Blocked by INN-35 (merged). Owner: Adebare.

---

## Scope

- [x] `convex/lib/services/riskScoringService.ts` — `scoreAccessRequest(input) → { score, outcome, reasons, factors }`
- [x] Factors: role, purpose, same vs cross facility, record count vs `normalPatientVolume`, time of day vs `normalAccessHours`
- [x] Thresholds documented in code: ALLOW < 40, VERIFY 40–79, BLOCK ≥ 80
- [x] Ibrahim treatment (cross-facility, 1 record) → 8 ALLOW
- [x] `recordCount >= 500` → at least 94 BLOCK with harvest / volume reasons
- [x] `reasons` never empty; `factors` matches `accessDecisions.factors`
- [x] Tests with vitest (`convex/riskScoring.test.ts`), including a speed check
- [x] Docs updated (README "What works today", `AGENTS.md`, `Innov8_DDD.md`, next-tasks rule, `docs/README.md`)

No schema changes, no public functions, no UI (decision UI belongs to INN-37).

---

## Implementation

### Part A — Scoring model

Additive points, clamped to 0–100, then the harvest rule.

| Factor | Points | Reason text (always one per factor) |
| --- | --- | --- |
| Base | 5 | — |
| Role: doctor, nurse, pharmacist, laboratory | 0 | "`<role>` is a clinical role" |
| Role: hospital_admin, system_admin | 15 | "Administrative role requesting clinical records" |
| Role: security_officer | 25 | "Security role requesting clinical records" |
| Role: patient / no clinical role | 80 | "Role is not permitted to request clinical records" |
| Purpose: treatment | 0 | "Treatment purpose" |
| Purpose: emergency, follow-up | 5 | |
| Purpose: referral | 8 | |
| Purpose: administrative | 20 | "Administrative purpose needs extra scrutiny" |
| Cross-facility | 3 | "Records are held at another facility" |
| Same facility | 0 | "Records are held at the requester's facility" |
| 1 record | 0 | "Single patient record" |
| 2 … baseline | 5 | "N records, within normal volume (baseline)" |
| > baseline | 35 | "N records, above normal volume (baseline)" |
| Outside `normalAccessHours` (non-clinical purposes only) | 15 | "Outside normal access hours" |

Baseline defaults to 20 when `normalPatientVolume` is missing. Access hours are interpreted in West Africa Time (UTC+1, no DST); overnight windows (start > end) are supported. Treatment and emergency skip the after-hours penalty so real night-time care — and the live demo — are not penalised.

**Harvest rule:** `recordCount >= 500` → `score = max(score, 94)` and adds "Harvest pattern: request covers N patient records".

Checks: Ibrahim treatment = 5 + 0 + 0 + 3 + 0 = **8**. Harvest = **94**. Administrative request after hours at the same facility = 5 + 20 + 15 = **40 → VERIFY** (matches the INN-44 example).

### Part B — API

```ts
scoreAccessRequest({
  actorRoles, purpose, recordTypes, recordCount,
  sameHospital, requestedAt, normalAccessHours?, normalPatientVolume?,
}) → {
  score, outcome, reasons,
  factors: { role, purpose, sameHospital, recordCount },
}
```

Throws on empty `recordTypes` or a `recordCount` that is not a whole number ≥ 1. Uses `assertRiskScore` and `assertDecisionReasons` from `convex/lib/invariants.ts`. `factors.role` is the first clinical role held, else the first role.

### Part C — Tests (`convex/riskScoring.test.ts`)

Demo invariants (8 ALLOW, 94 BLOCK with harvest reasons, independent of time of day and purpose), each threshold boundary, role and purpose weights, volume bands and default baseline, after-hours only for non-clinical purposes, overnight windows, input validation, `factors` shape, and 10,000 scores well under one second.

---

## Open questions

- [ ] INN-37 decides how `recordCount` and `sameHospital` are derived from the session user and patient record index.

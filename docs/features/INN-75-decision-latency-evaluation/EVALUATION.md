# INN-75: Decision engine measurement (target, not an SLO)

NFR-04 asks that **95% of normal access decisions finish inside 1 second in the decision engine**, excluding network. §15 also asks for honest evaluation: attack detection, false positives, access-control accuracy, detection latency, and that emergency access still works.

These numbers are a **laptop measurement** of pure `scoreAccessRequest`. They are not a production SLO and they do not include Convex or the browser.

Re-run: `npx vitest run convex/decisionEvaluation.test.ts`

## Method

- Engine only: `scoreAccessRequest` in `convex/lib/services/riskScoringService.ts`.
- Cases in `convex/lib/decisionEvaluation.ts`: **normal** (Ibrahim treatment, 1 record), **harvest** (500 records), **VERIFY** (same as normal plus missing consent).
- 50 warmup calls, then 2,000 timed calls **per case**. Percentiles are nearest-rank on those samples.
- CI asserts p50 and p95 **< 1000 ms** for every labelled case (`NFR04_P95_TARGET_MS`).

## Latency (2026-09-18, Windows, Node via Vitest)

One run of `convex/decisionEvaluation.test.ts` (50 warmup + 2,000 timed calls per case):

| Case | Outcome | p50 (ms) | p95 (ms) | max (ms) |
| --- | --- | --- | --- | --- |
| normal (Ibrahim treatment, 1 record) | ALLOW 8 | 0.0014 | 0.0036 | 0.0747 |
| harvest (500 records) | BLOCK 94 | 0.0014 | 0.0025 | 0.5602 |
| VERIFY (missing consent) | VERIFY 43 | 0.0017 | 0.0033 | 0.6896 |

p95 is **orders of magnitude inside** the 1-second NFR-04 target. These figures will move with the machine and timer resolution; they are evidence that the engine is not near 1s, not a production SLO.

## Detection and false positives

| Scenario | Engine outcome | Notes |
| --- | --- | --- |
| Ibrahim treatment, 1 record | ALLOW 8 | Demo true negative for “attack” |
| 500-record harvest | BLOCK 94 | Harvest rule fires; detection rate 100% in this synthetic case |
| Missing cross-facility consent | VERIFY 43 | Intended challenge, not a harvest BLOCK |
| After-hours hospital admin, administrative purpose | VERIFY 55 | Role + purpose + hours. Not a harvest false positive |

Access-control **accuracy** here means the engine matches those labelled demo cases. It is not a labelled clinical dataset.

**Detection latency** for harvest is the same as one `scoreAccessRequest` call (sub-millisecond in this measurement). Alert persistence and UI refresh are outside the engine.

**Emergency access** does not wait on this score: break-glass is a separate grant (`INN-41`). A BLOCK/VERIFY request can still open records while a live grant exists.

## What this does not measure

- Convex mutation time, `recordAccessRequest` disk writes, or the Next.js round trip.
- A production 95th percentile under load.
- Real attacker traffic.

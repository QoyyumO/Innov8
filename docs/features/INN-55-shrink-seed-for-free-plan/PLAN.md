# INN-55: Shrink seed for Convex free-plan storage — Implementation Plan

**Git branch:** `INN-55-shrink-seed-for-free-plan`

## Context

The §14 seed (INN-19 / 31 / 32 / 33) wrote 10k patients and 100k access events onto the shared Convex team and exceeded the free-plan cap (~635 MB / 512 MB storage). This follow-up keeps the 7-step demo on a laptop-sized dataset. Do not reopen those tickets.

---

## Scope

- [x] Default seed: 3 facilities, 24 workers, 200 patients plus always PAT-002391, 200 access events + Ibrahim ALLOW 8 / BLOCK 94
- [x] Insert Chioma independently of sequential `total`
- [x] Internal batched wipe mutations
- [x] Clear the over-quota deployment and reseed
- [x] Docs: demo-scale is the default; 10k/100k must not run on the free plan

---

## Implementation

### Part A — Seed defaults

Named constants in `convex/lib/synthetic.ts`. `seedPatientsBatch` upserts PAT-002391 on the first batch even when `total` is 200. CLI args still override.

### Part B — Wipe

`clearSeedDataBatch` deletes high-volume tables in order (audit → alerts → emergency → decisions → requests → summaries → indexes → patients → tokens/sessions → extra workers), scheduler-chained. Facilities stay.

### Part C — Runbook

`seedDemoDataset` starts facilities → workers → patients → events. README and `convex/README-seeding.md` drop full §14 as the default path.

---

## Open questions

- [ ] Remaining monthly I/O may stall a row-by-row wipe; fallback is a new Convex project plus deleting the old one.

# INN-76: Judges demo script — VERIFY, security queue, and patient portal — Implementation Plan

**Git branch:** `INN-76-judges-demo-script`

## Context

Product already has VERIFY/step-up, the security queue, Chioma's portal, and `/facilities`. They were not in the Ibrahim-only live pass. This ticket is a **judges script**, not new engineering.

Stacked on INN-75.

---

## Scope

- [x] README steps after the seven-step Ibrahim path: VERIFY + step-up, security officer queue, patient portal, facilities
- [x] Note that step-up is refused until consent exists (INN-45)
- [x] Note `/facilities` is hidden from clinicians (INN-68)
- [x] No new product code

---

## Implementation

Root `README.md` “Judges dry-run” after **What works today**. Pointers in `AGENTS.md`, `Innov8_DDD.md`, `.cursor/rules/innov8-next-tasks.mdc`, `docs/README.md`.

---

## Open questions

- None.

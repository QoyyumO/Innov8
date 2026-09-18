# INN-84: Align QA checklist with consent-gated step-up — Implementation Plan

**Git branch:** `INN-84-align-qa-consent-gated-step-up`

## Context

QA expected a missing-consent VERIFY to become ALLOW from the clinician password, and for wrong passwords to decrement attempts immediately. Product: step-up is refused while consent is missing; failures are not counted. After consent, wrong passwords decrement; 3rd failure BLOCKs. Do not let step-up bypass consent.

Stacked on INN-83.

---

## Scope

- [x] `docs/qa/TEST-FINDINGS.md`: missing-consent VERIFY is not password-only ALLOW; remaining attempts after consent
- [x] Keep **Patient consent needed first** copy
- [x] README judges script stays the source of the walkthrough

---

## Implementation

Docs only.

---

## Open questions

- None.

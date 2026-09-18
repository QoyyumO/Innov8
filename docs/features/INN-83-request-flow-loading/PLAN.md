# INN-83: Request-flow loading and keep the decision in view — Implementation Plan

**Git branch:** `INN-83-request-flow-loading`

## Context

QA: three request-flow clicks felt like no-ops. Do not change scoring or audit.

Stacked on INN-82.

---

## Scope

- [x] Patient **Request access** shows `Requesting access…` until navigation
- [x] After submit, keep ALLOW/VERIFY/BLOCK in view (compact outcome + scroll)
- [x] **View authorised records** label `Opening authorised records…` while loading

---

## Implementation

`patients/[publicId]/page.tsx`, `AccessRequestForm.tsx`, `AuthorisedSummary.tsx`.

---

## Open questions

- None.

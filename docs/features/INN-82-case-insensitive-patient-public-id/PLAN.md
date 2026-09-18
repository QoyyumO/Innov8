# INN-82: Document case-insensitive patient public ID search — Implementation Plan

**Git branch:** `INN-82-case-insensitive-patient-public-id`

## Context

QA was unsure whether `pat-002391` matches `PAT-002391`. Discovery already normalizes with `trim().toUpperCase()`. Do not add a second matching path.

---

## Scope

- [x] README: public IDs are case-insensitive
- [x] convex-test: lowercase / mixed-case publicId hits search and discovery
- [x] QA checklist note in `docs/qa/TEST-FINDINGS.md`

---

## Implementation

Docs plus tests against the existing `normalizePublicId` helper. `recordPatientDiscovery` stores that normalized id on the audit row so `pat-002391` and `PAT-002391` are one discovery per session.

---

## Open questions

- None.

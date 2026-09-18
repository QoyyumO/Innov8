# Deployed QA expected results

Local testers kept notes in an untracked `test-findings.local.md`. This file is the committed expected-results list for those checks.

## Patient public ID (INN-82)

Public IDs are **case-insensitive**. `PAT-002391`, `pat-002391`, and mixed case (for example `Pat-002391`) all return Chioma. Search and discovery use one `trim().toUpperCase()` helper — there is not a second matcher.

## Consent-gated step-up (INN-84)

A missing-consent VERIFY does **not** become ALLOW from the clinician password alone. **Complete verification** is refused (`STEP_UP_CONSENT_REQUIRED`); those failures are **not** counted. After consent is recorded on the patient page, wrong passwords persist `stepUpFailures` and show remaining attempts; the 3rd failure BLOCKs and alerts security. Keep the **Patient consent needed first** copy on the request.

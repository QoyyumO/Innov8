# Deployed QA expected results

Local testers kept notes in an untracked `test-findings.local.md`. This file is the committed expected-results list for those checks.

## Patient public ID (INN-82)

Public IDs are **case-insensitive**. `PAT-002391`, `pat-002391`, and mixed case (for example `Pat-002391`) all return Chioma. Search and discovery use one `trim().toUpperCase()` helper — there is not a second matcher.

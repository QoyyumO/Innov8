# INN-44: VERIFY / step-up challenge path — Implementation Plan

**Git branch:** `INN-44-verify-step-up`

## Context

The risk engine (INN-38) already returns VERIFY for mid-risk requests (e.g. administrative access after hours), and INN-37 audits it as `AccessChallenged`. Until now a VERIFY request was a dead end: nothing was released, and there was no way to complete it. This should-have ticket adds the step-up. Unblocked (INN-37 is done); owner Adebare.

Decisions (agreed with Eno):
- Step-up is **re-entering the clinician's own password**. No new identity table and no OTP.
- **3 wrong passwords block the request** and raise a security alert.

---

## Scope

- [x] `accessDecisions` gains optional `verifiedAt`, `stepUpFailures`, `escalatedAt` (no backfill needed)
- [x] `convex/lib/stepUpConstants.ts` (client-safe) and `convex/lib/services/stepUpService.ts`
- [x] `convex/stepUp.ts` — `completeVerification({ token, requestId, password })` → `verified` / `failed` (attempts left) / `blocked`
- [x] Only the requester's own single-patient VERIFY request is eligible; anything else is refused and writes nothing
- [x] Right password: decision becomes ALLOW with `verifiedAt` and an extra reason; audits `StepUpCompleted` and `AccessAllowed` (`viaStepUp`). The 24-hour window (INN-51) starts at `verifiedAt`
- [x] Wrong password: counted and audited as `StepUpFailed`. The third makes the decision BLOCK with `escalatedAt`, audits `AccessBlocked` (`escalatedFromVerify`), and raises a high alert
- [x] Empty password is rejected without counting
- [x] Request views expose `verifiedAt`, `escalatedAt`, and `stepUpAttemptsLeft` (VERIFY only)
- [x] UI: `StepUpVerification` (button + password dialog). It opens automatically when a new request returns VERIFY, and appears on `/requests/[requestId]` and in the `/requests` list. `DecisionResult` shows verified / escalated state. `/audit` labels the new actions
- [x] Tests in `convex/stepUp.test.ts`
- [x] Docs updated

---

## Implementation

Wrong passwords **return** a result rather than throwing. A thrown Convex error rolls back the whole mutation, which would erase the failure count and its audit row.

The decision row is updated in place. The audit trail keeps its history: `AccessChallenged`, then `StepUpFailed` / `StepUpCompleted`, then `AccessAllowed` or `AccessBlocked`.

An escalated BLOCK keeps its original `decidedAt`, so "blocked today" on the security dashboard counts it on the day of the VERIFY decision, not the day of the escalation.

Break-glass still works on a VERIFY request, and on an escalated BLOCK.

---

## Open questions

- [ ] Each new VERIFY request gets its own 3 attempts. A per-clinician lockout across requests is out of scope.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Innov8 Health — Hackathon MVP

NITDA / ICSC Track C: **Safe Access to Patient Records**.

Innov8 Health is a **secure patient-record access layer**, not a hospital management system and not a national EMR. The challenge window is about three weeks. Build one finishable, end-to-end demonstration — not every healthcare workflow.

Use synthetic data only. Never use real patient information.

Full problem, requirements, and architecture notes live in `Innov8_Health_Track_C_Deep_Dive.docx`. When product scope is unclear, prefer that document and this MVP over inventing new features.

## What the MVP must prove

A clinician at one Federal Medical Centre can request another facility's records for a real clinical purpose. The platform evaluates identity, role, purpose, relationship, and behaviour, then **allows**, **challenges**, or **blocks** the request — and leaves an audit trail.

Core sentence:

> Innov8 Health shall authenticate healthcare workers, identify patients across participating facilities, evaluate contextual and behavioural risk for every record-access request, enforce appropriate access decisions, provide controlled emergency access, and maintain an auditable record of all activity.

## Demo scenario (definition of done)

A patient normally treated at **FMC Lagos** travels to **FMC Abuja** and needs care. Walk this path in the UI without extra setup.

| Step | Action | Expected result |
| --- | --- | --- |
| 1. Authenticate | **Dr. Ibrahim**, FMC Abuja, Cardiology, signs in | Session carries identity, hospital, role, and account status |
| 2. Search | Look up **PAT-002391** | Patient is identified. Records exist at FMC Lagos. Contents are **not** dumped automatically |
| 3. Request | Purpose: **Treatment**. Ask for medical summary, allergies, medications, previous diagnoses | Request is recorded with actor, facility, role, record type, purpose, time, and session |
| 4. Evaluate | Identity, role, hospital, purpose, relationship, consent, behaviour | Risk **8/100** → **ALLOW** |
| 5. View | Doctor opens the authorised summary | Only permitted fields are shown |
| 6. Suspicious | Same doctor suddenly requests **500** patient records | Risk **94/100** → **BLOCK**. Security officer is alerted. Event is audited |
| 7. Emergency | Doctor uses break-glass with a justification | Temporary access is granted and **must** be audited |

If a change does not help this demo, it is out of scope for the MVP.

## Build these capabilities

- Authentication for healthcare workers (and later patients, security officers)
- Role and facility-aware permissions (RBAC plus contextual checks)
- Cross-facility patient identity and record **discovery** (existence, not full disclosure)
- Purpose-based access requests (treatment, emergency, referral, follow-up, administrative)
- Contextual decision: **ALLOW / VERIFY / BLOCK**
- Behavioural risk scoring with visible reasons
- High-risk blocking plus a security alert
- Break-glass emergency access: justification, short duration, mandatory audit
- Audit log of login, search, request, decision, view, emergency, and alerts
- Federated exchange **simulation** (separate Lagos / Abuja data, one secure exchange layer)
- Security dashboard for blocked requests, risk, emergency access, and alerts
- Synthetic dataset of patients, workers, hospitals, records, and access events

## Do not build

- A full national EMR or hospital operations suite
- Real-patient data, national ID integration, or live hospital EMR connectors
- Point-to-point hospital coupling (every facility talking to every other facility)
- Production disaster recovery, HSMs, or regulatory certification
- Features that skip the access-decision path (search → purpose → risk → allow/block → audit)

Consent, step-up verification, record writing, deep audit investigation, and a patient dashboard are **should-have**. Implement them only after the demo scenario works end to end.

## Implementation rules

- Cursor project rules live in `.cursor/rules/`. Task skills: `start-task`, `review-branch-vs-main`, `create-pull-requests`, `frontend-design` under `.cursor/skills/`.
- Prefer a working demonstration over architectural completeness.
- Keep major pieces separable: authentication, access control, consent, risk engine, record exchange, audit.
- Decisions must be explainable: show why risk is high, not only a score.
- Emergency access must still work when normal consent cannot be completed, and must still be justified, time-boxed, and audited.
- Label performance as a target, then measure: 95% of normal access decisions inside 1 second in the decision engine.
- Use free/open-source tools that run on a normal laptop.

## Current status and next work

Foundational UI is in place: session login, password reset, account settings, and live role dashboards (INN-43).

On `main` (plans in `docs/features/`, index in `docs/README.md`):

- **INN-18** schema and **INN-19** §14 seed — tables in `convex/schema.ts`, seed in `convex/seed.ts`. **INN-55** shrinks the operational seed to demo-scale (24 workers, 200 patients plus PAT-002391, 200 events) so the Convex free plan stays under the storage cap; `clearSeedDataBatch` wipes an oversized deployment before reseeding.
- **INN-35** session and audit plumbing — `requireSession` / `publicUser` (`convex/lib/session.ts`), `requireRole` + role groups (`convex/lib/roles.ts`), insert-only `appendAuditEvent` (`convex/lib/services/auditLogService.ts`). Every domain function must use these; never authorize from a client `userId`.
- **INN-36** patient discovery — `convex/patients.ts`, `/patients`, `/patients/[publicId]`. Demo step 2 works: identity + record existence only, audited.
- **INN-47** password reset hardening — hashed single-use reset tokens (15 min), issued via `internal.auth.issuePasswordResetToken` (no email yet). Sessions last 30 minutes by default, or 7 days when Keep me logged in is checked (INN-54); suspended accounts are rejected everywhere.
- **INN-48** clean-checkout build — no `prepare` script; `type-check` runs `next typegen` first.
- **INN-38** risk scoring — pure `scoreAccessRequest` in `convex/lib/services/riskScoringService.ts`. Additive, explainable points (role, purpose, cross-facility, volume vs baseline, after-hours for non-clinical purposes) plus a harvest rule (≥ 500 records → at least 94). ALLOW < 40, VERIFY 40–79, BLOCK ≥ 80. Ibrahim treatment → 8; harvest → 94. Returns `reasons` and an `accessDecisions.factors` snapshot; the caller persists the decision.
- **INN-37** access requests — `convex/accessRequests.ts` (`createAccessRequest`, `listMyAccessRequests`, `getAccessRequest`) + `convex/lib/services/accessControlService.ts`. Clinicians only; source facility from `users.facilityId` (falls back to `hospital` name), target from the patient's record index; stores request + decision; audits `AccessRequested` and `AccessAllowed` / `AccessChallenged` / `AccessBlocked`. UI: `/requests`, `/requests/new`, `/requests/[requestId]`. Demo steps 3–4 work. Scores one patient per request; `recordCount` is never a client argument.
- **INN-40** authorised summary — `convex/records.ts` `viewAuthorisedSummary` (mutation, so it can audit) + `convex/lib/services/recordExchangeService.ts`. Only the requester; only after ALLOW or a live emergency grant on the same request; only the requested record types; only the target facility's summary (`conditions` never returned). Audits `RecordViewed`. UI: **View authorised records** on `/requests/[requestId]`. Demo step 5 works.
- **INN-39** harvest block + alerts — `simulateBulkHarvest` (clinicians; the server fixes `recordCount` at 500, one request row) is the demo harvest; `createAccessRequest` stays one patient. Both share `recordAccessRequest`, so every BLOCK raises a high, open `securityAlerts` row and audits `SecurityAlertRaised` (`convex/lib/services/alertService.ts`). `convex/alerts.ts`: `listSecurityAlerts` (security officers + admins, paginated, status filter), `acknowledgeAlert`, `closeAlert` (open → acknowledged → closed; never deleted). UI: harvest simulation on `/requests`, `/security` queue, live open alerts on the security dashboard. Demo step 6 works. Acknowledge / close are audited as `SecurityAlertAcknowledged` / `SecurityAlertClosed` with the officer as actor (INN-50).
- **INN-41** break-glass — `convex/emergency.ts` (`grantEmergencyAccess`, `getActiveEmergencyAccess`, `revokeEmergencyAccess`, internal `expireEmergencyAccess`) + `convex/lib/services/emergencyAccessService.ts`. Clinicians only; justification 10–500 characters; one live grant per clinician and patient; the server fixes the length at 15 minutes (`EMERGENCY_ACCESS_TTL_MS`). Either links to the caller's own single-patient BLOCK/VERIFY request or creates an `emergency`-purpose request with no decision. Audits `EmergencyGranted`, raises a medium alert with `emergencyAccessId`, and schedules expiry (`EmergencyExpired`). The holder, security officers, and admins can end it early (`EmergencyRevoked`). When a request has a grant, the grant alone decides whether records open. UI: `/emergency`, **Use break-glass** on blocked/challenged requests, grant card on `/requests/[requestId]`, **Revoke access** on `/security`. Demo step 7 works.
- **INN-42** audit trail — `convex/audit.ts` `listAuditEvents` (paginated, newest first by `createdAt`, optional `action` / `actorId`). Everyone sees their own events; security officers and admins see all and may filter to one actor (others asking for someone else → permission denied). Uses `auditEvents` indexes `by_createdAt`, `by_actorId_createdAt`, `by_action_createdAt`, `by_actorId_action_createdAt` — never `.collect()`. No write functions. UI: `/audit` with an action filter; reviewers click a name to open that person's trail.
- **INN-52** facility scope — `getReviewScope` (`convex/lib/roles.ts`): security officers and system admins are `global`; hospital admins are `facility` (`convex/lib/facilityScope.ts`: `users.facilityId`, else the facility named like `users.hospital`, else nothing). A hospital admin sees their staff's actions and every request (decision, alert, grant, audit event) whose source or target is their facility. Backed by `auditEventFacilities` (written by `appendAuditEvent` via `auditFacilityService`) and `alertFacilities` (written by the alert service, status kept in sync). Applied in `listAuditEvents`, `listSecurityAlerts`, alert transitions, `getAccessRequest`, `revokeEmergencyAccess`, and `getSecurityDashboard`. Existing data: `npx convex run facilityScopeBackfill:start`.
- **INN-53** stored totals — `facilityStats` (`workerCount`, `patientCount` per facility), kept exact by `convex/lib/facilityStats.ts` (`insertCountedUser`, `patchCountedUser`, `insertCountedPatient`, `patchCountedPatient`). A worker is a facility-linked user with a non-patient role. **Every user/patient insert or facility change must use these helpers.** `listFacilities` returns the totals; `getSecurityDashboard.population` is the exchange sum (or the hospital admin's facility). Rebuild: `npx convex run facilityStatsRecount:start`.
- **INN-43** live dashboards — `convex/dashboards.ts`: `getClinicianDashboard` and `getSecurityDashboard` (both take `since`, the start of the Lagos day from `startOfLagosDay`, so they stay cacheable) and `listFacilities`. Every read is an index range or a `.take()` cap from `convex/lib/dashboardConstants.ts`; capped counts return `isCapped` and show as `100+`. `accessDecisions.by_outcome` became `by_outcome_decidedAt`. UI: one `ClinicianDashboard` (per-role copy) for doctor/nurse/pharmacist/laboratory; live security and admin dashboards; `/facilities`. `dashboardDummy.ts` is gone.
- **INN-51** ALLOW expiry — an ALLOW releases records for `ALLOW_VALIDITY_MS` (24 h, `convex/lib/accessWindow.ts`, server-fixed) from `decidedAt`. After that `resolveViewAuthorisation` denies with `ALLOW_EXPIRED_REASON`, and `viewAuthorisedSummary` audits `AccessExpired` (BLOCK/VERIFY refusals are not audited). A request with a break-glass grant is still governed by the grant. Request views carry `decision.allowedUntil` (ALLOW only); the request page offers **Request access again**.
- **INN-54** leftover QA — `login` returns `{ success: false, error }` instead of throwing; `/login` shows `errorTitle` / `errorMessage`; Keep me logged in uses a server-fixed 7-day TTL; non-harvest seed `recordCount` is 1; closed mobile sidebar does not steal taps.
- **INN-44** step-up — `convex/stepUp.ts` `completeVerification` + `convex/lib/services/stepUpService.ts`. Only the requester's own single-patient VERIFY request is eligible. The right password turns the decision into ALLOW (`verifiedAt`, window starts then) and audits `StepUpCompleted` + `AccessAllowed`. Wrong passwords return `failed` (never throw, so the count and `StepUpFailed` audit persist); the 3rd (`STEP_UP_MAX_FAILURES`) turns it into BLOCK (`escalatedAt`), audits `AccessBlocked`, and raises a high alert. UI: `StepUpVerification` dialog on `/requests/new`, `/requests/[requestId]`, and `/requests`.

Tests: `npm test` (vitest + convex-test, `convex/**/*.test.ts`). Run it with `npm run check` before every PR.

Domain map: `Innov8_DDD.md`. SIMS `DDD_Proposal.md` is a method reference only — do not import school entities.

**Next:** the MVP demo path is complete. Should-have work: INN-45 (consent), INN-46 (patient portal). Follow-ups: none open. Do **not** revive canceled tickets INN-5–INN-17 or INN-34; file new Innov8 issues. Check Linear for the current assignee before starting a ticket.

When a ticket changes what works, update `README.md` ("What works today"), `docs/README.md`, this section, `Innov8_DDD.md`, and `.cursor/rules/innov8-next-tasks.mdc` in the same PR.

Use Linear **Innov8** only. Never Skilladder.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

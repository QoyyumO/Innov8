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
- **INN-36** patient discovery — `convex/patients.ts`, `/patients`, `/patients/[publicId]`. Demo step 2 works: identity + record existence only, audited. Every `searchPatients` call that reaches an index writes `PatientSearched`, including zero hits (`resultCount: 0`) (INN-56). A query rejected before any lookup — empty, or a name prefix under `NAME_PREFIX_MIN_LENGTH` — is not a search and is not audited; `isSearchableQuery` in `convex/lib/searchLimits.ts` is the single definition of that line, shared by the service, the mutation, and the search form. Note this covers `searchPatients` only: `getPatientDiscovery` is an unaudited query (INN-69), so the audit trail does not yet cover ID enumeration end to end.
- **INN-47** password reset hardening — hashed single-use reset tokens (15 min), issued via `internal.auth.issuePasswordResetToken` (no email yet). Sessions last 30 minutes by default, or 7 days when Keep me logged in is checked (INN-54); suspended accounts are rejected everywhere. Demo logins are inserted by seed (`internal.auth.ensureDemoUsers` from `seedHealthcareWorkers`); public `login` does not recreate them (INN-57).
- **INN-48** clean-checkout build — no `prepare` script; `type-check` runs `next typegen` first.
- **INN-38** risk scoring — pure `scoreAccessRequest` in `convex/lib/services/riskScoringService.ts`. Additive, explainable points (role, purpose, cross-facility, volume vs baseline, after-hours for non-clinical purposes) plus a harvest rule (≥ 500 records → at least 94). ALLOW < 40, VERIFY 40–79, BLOCK ≥ 80. Ibrahim treatment → 8; harvest → 94. Returns `reasons` and an `accessDecisions.factors` snapshot; the caller persists the decision.
- **INN-37** access requests — `convex/accessRequests.ts` (`createAccessRequest`, `listMyAccessRequests`, `getAccessRequest`) + `convex/lib/services/accessControlService.ts`. Clinicians only; source facility from `users.facilityId` (falls back to `hospital` name), target from the patient's record index; stores request + decision; audits `AccessRequested` and `AccessAllowed` / `AccessChallenged` / `AccessBlocked`. UI: `/requests`, `/requests/new`, `/requests/[requestId]`. Demo steps 3–4 work. Scores one patient per request; `recordCount` is never a client argument.
- **INN-40** authorised summary — `convex/records.ts` `viewAuthorisedSummary` (mutation, so it can audit) + `convex/lib/services/recordExchangeService.ts`. Only the requester; only after ALLOW or a live emergency grant on the same request; only the requested record types; only the target facility's summary (`conditions` never returned). Audits `RecordViewed`. UI: **View authorised records** on `/requests/[requestId]`. Demo step 5 works.
- **INN-39** harvest block + alerts — `simulateBulkHarvest` (clinicians; the server fixes `recordCount` at 500, one request row) is the demo harvest; `createAccessRequest` stays one patient. Both share `recordAccessRequest`, so every BLOCK raises a high, open `securityAlerts` row and audits `SecurityAlertRaised` (`convex/lib/services/alertService.ts`). `convex/alerts.ts`: `listSecurityAlerts` (security officers + admins, paginated, status filter), `acknowledgeAlert`, `closeAlert` (open → acknowledged → closed; never deleted). UI: harvest simulation on `/requests`, `/security` queue, live open alerts on the security dashboard. Demo step 6 works. Acknowledge / close are audited as `SecurityAlertAcknowledged` / `SecurityAlertClosed` with the officer as actor (INN-50).
- **INN-41** break-glass — `convex/emergency.ts` (`grantEmergencyAccess`, `getActiveEmergencyAccess`, `revokeEmergencyAccess`, internal `expireEmergencyAccess`) + `convex/lib/services/emergencyAccessService.ts`. Clinicians only; justification 10–500 characters; one live grant per clinician and patient; the server fixes the length at 15 minutes (`EMERGENCY_ACCESS_TTL_MS`). Either links to the caller's own single-patient BLOCK/VERIFY request or creates an `emergency`-purpose request with no decision. Audits `EmergencyGranted`, raises a medium alert with `emergencyAccessId`, and schedules expiry (`EmergencyExpired`). The holder, security officers, and admins can end it early (`EmergencyRevoked`). When a request has a grant, the grant alone decides whether records open. UI: `/emergency`, **Use break-glass** on blocked/challenged requests, grant card on `/requests/[requestId]`, **Revoke access** on `/security`. Demo step 7 works.
- **INN-42** audit trail — `convex/audit.ts` `listAuditEvents` (paginated, newest first by `createdAt`, optional `action` / `actorId`). Everyone sees their own events; security officers and admins see all and may filter to one actor (others asking for someone else → permission denied). Uses `auditEvents` indexes `by_createdAt`, `by_actorId_createdAt`, `by_action_createdAt`, `by_actorId_action_createdAt` — never `.collect()`. No write functions. UI: `/audit` with an action filter; reviewers click a name to open that person's trail. Logout, password change, password reset, and profile update are audited as `UserLoggedOut` / `PasswordChanged` / `PasswordReset` / `ProfileUpdated` (INN-58).
- **INN-52** facility scope — `getReviewScope` (`convex/lib/roles.ts`): security officers and system admins are `global`; hospital admins are `facility` (`convex/lib/facilityScope.ts`: `users.facilityId`, else the facility named like `users.hospital`, else nothing). A hospital admin sees their staff's actions and every request (decision, alert, grant, audit event) whose source or target is their facility. Backed by `auditEventFacilities` (written by `appendAuditEvent` via `auditFacilityService`) and `alertFacilities` (written by the alert service, status kept in sync). Applied in `listAuditEvents`, `listSecurityAlerts`, alert transitions, `getAccessRequest`, `revokeEmergencyAccess`, and `getSecurityDashboard`. Existing data: `npx convex run facilityScopeBackfill:start`.
- **INN-53** stored totals — `facilityStats` (`workerCount`, `patientCount` per facility), kept exact by `convex/lib/facilityStats.ts` (`insertCountedUser`, `patchCountedUser`, `insertCountedPatient`, `patchCountedPatient`). A worker is a facility-linked user with a non-patient role. **Every user/patient insert or facility change must use these helpers.** `listFacilities` returns the totals; `getSecurityDashboard.population` is the exchange sum (or the hospital admin's facility). Rebuild: `npx convex run facilityStatsRecount:start`.
- **INN-45** consent — `consents` table + `convex/lib/services/consentService.ts` + `convex/consents.ts` (`getConsentStatus`, `recordPatientConsent`, `revokePatientConsent`, `listConsents`). Single-patient, cross-facility requests with purpose other than `emergency` need a live consent for the requesting facility; `evaluateConsent` feeds `RiskInput.consent` (missing → +35, at least VERIFY; reason in the decision; `factors.consent`). Step-up is refused until consent exists. Clinicians record consent (note, 30 days, `ConsentRecorded`); security officers / admins in scope revoke (`ConsentRevoked`). The seed gives PAT-002391 consent for FMC Abuja so the demo stays ALLOW 8. Break-glass never needs consent. UI: consent panel on `/patients/[publicId]`, consents table on `/security`.
- **INN-43** live dashboards — `convex/dashboards.ts`: `getClinicianDashboard` and `getSecurityDashboard` (both take `since`, the start of the Lagos day from `startOfLagosDay`, so they stay cacheable), `getPatientDashboard` (patient role + `users.patientId` only; no client patient selector), and `listFacilities`. Every read is an index range or a `.take()` cap from `convex/lib/dashboardConstants.ts`; capped counts return `isCapped` and show as `100+`. `accessDecisions.by_outcome` became `by_outcome_decidedAt`. UI: one `ClinicianDashboard` (per-role copy) for doctor/nurse/pharmacist/laboratory; live security and admin dashboards; Chioma's `PatientDashboard` shows PAT-002391 and who requested her records; `/facilities`. `dashboardDummy.ts` is gone.
- **INN-51** ALLOW expiry — an ALLOW releases records for `ALLOW_VALIDITY_MS` (24 h, `convex/lib/accessWindow.ts`, server-fixed) from `decidedAt`. After that `resolveViewAuthorisation` denies with `ALLOW_EXPIRED_REASON`, and `viewAuthorisedSummary` audits `AccessExpired` (BLOCK/VERIFY refusals are not audited). A request with a break-glass grant is still governed by the grant. Request views carry `decision.allowedUntil` (ALLOW only); the request page offers **Request access again**.
- **INN-54** leftover QA — `login` returns `{ success: false, error }` instead of throwing; `/login` shows `errorTitle` / `errorMessage`; Keep me logged in uses a server-fixed 7-day TTL; non-harvest seed `recordCount` is 1; closed mobile sidebar does not steal taps.
- **INN-44** step-up — `convex/stepUp.ts` `completeVerification` + `convex/lib/services/stepUpService.ts`. Only the requester's own single-patient VERIFY request is eligible. The right password turns the decision into ALLOW (`verifiedAt`, window starts then) and audits `StepUpCompleted` + `AccessAllowed`. Wrong passwords return `failed` (never throw, so the count and `StepUpFailed` audit persist); the 3rd (`STEP_UP_MAX_FAILURES`) turns it into BLOCK (`escalatedAt`), audits `AccessBlocked`, and raises a high alert. UI: `StepUpVerification` dialog on `/requests/new`, `/requests/[requestId]`, and `/requests`.

Tests: `npm test` (vitest + convex-test, `convex/**/*.test.ts`). Run it with `npm run check` before every PR.

Domain map: `Innov8_DDD.md`. SIMS `DDD_Proposal.md` is a method reference only — do not import school entities.

- **INN-46** patient portal — `getPatientDashboard`: session user must have role `patient` and an explicit `users.patientId` (seeded Chioma → PAT-002391). Returns identity, home facility, and bounded `auditEvents` indexed by `patientId`. Clinician tokens get `null`. UI replaces the dummy patient dashboard. No patient-facing consent on this ticket.
- **INN-57** login seed — public `login` looks up the user and verifies the password only. Demo accounts come from `internal.auth.ensureDemoUsers` (called by `seedHealthcareWorkers`). Suspended or deleted demo users are not recreated by login.
- **INN-58** account audits — `logout`, `changePassword`, `resetPassword`, and `updateProfile` each write one audit row on success (`UserLoggedOut`, `PasswordChanged`, `PasswordReset`, `ProfileUpdated`). No password, reset token, or session token in `details`.
- **INN-66** password verification — `convex/lib/password.ts`. `verifyPassword` parses the stored hash before using it and returns `false` for anything malformed; it **never throws**, because a throw inside `completeStepUp` rolls back the failure counter and its `StepUpFailed` audit row. Iterations must be a plain integer within 1,000-1,000,000 (`hashPassword` writes 100,000), salt and digest must be exact-length hex. The digest compare accumulates over every byte instead of short-circuiting. A hash that does not parse logs a server-side breadcrumb, since a corrupt credential row otherwise locks a user out silently. Stored format is unchanged, so no re-hashing.

- **INN-62** newest grant — a request can carry several break-glass grants, because a clinician may break glass again once a 15-minute grant lapses. `findLatestGrantForRequest` (`convex/lib/services/emergencyAccessService.ts`) is the one lookup for "the grant that decides right now": `by_requestId`, `.order("desc")`, `.first()`. `.first()` without an order returns the **oldest** row, so `dashboards.ts` and `accessRequests.ts` both go through the helper rather than querying inline. The break-glass badge now shows on re-granted requests.

- **INN-64 / INN-61** session lifecycle — `convex/sessions.ts`. `createSession` schedules `internal.sessions.expireSession` at `expiresAt`, so a session **deletes itself**. That delete is a write, which is what makes expiry reactive: a subscribed query does not re-run just because the clock moved, so before this a tab left open could keep serving records after the session lapsed. `purgeUserSessions` pages instead of `.collect()` and hands any remainder to `internal.sessions.purgeSessionsForUser`, so a password reset cannot fail on transaction limits. `convex/crons.ts` sweeps `by_expiresAt` hourly as a backstop for jobs that never ran. The clock check in `getUnexpiredSession` stays as a guard for the window before the job fires - it can only reject earlier, never extend a session.
- **INN-60** validation errors — user-facing throws use `ConvexError({ code, message })` (`convex/lib/appError.ts`). Production Convex redacts a plain `Error` to `"Server Error"`; the client shows `error.data.message` via `toUserFacingError`. Shared `findXInputError` substring helpers are gone.

**Next:** [INN-60](https://linear.app/innov8-health/issue/INN-60) throw `ConvexError` so validation messages survive in production (this branch). Do **not** revive canceled tickets INN-5–INN-17 or INN-34; file new Innov8 issues. Check Linear for the current assignee before starting a ticket.

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

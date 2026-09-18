# Innov8 Health — Domain model (MVP)

Use this as the DDD map for the access layer. The SIMS `DDD_Proposal.md` is only a **method reference** (entities → aggregates → services → events). Do **not** import school, course, enrollment, or grade entities into this repo.

Innov8 is a **secure patient-record access layer**, not an EMR.

Linear: [Innov8 workspace](https://linear.app/innov8-health) · project **Track C Demo Path**. Never use Linear Skilladder.

## Done (foundational UI)

- Session auth, roles, account settings
- Role dashboards (live since INN-43)
- Healthcare palette and AppShell

## Done (schema + §14 seed)

1. **Adebare** — Convex schema [INN-18](https://linear.app/innov8-health/issue/INN-18) (INN-20…INN-30) on `main`. Plan: `docs/features/INN-18-convex-schema-access-layer/PLAN.md`.
2. **Henry** — synthetic seed [INN-19](https://linear.app/innov8-health/issue/INN-19) (INN-31 patients, INN-32 workers, INN-33 access events). Plan: `docs/features/INN-19-synthetic-datasets-from-section-14/PLAN.md`. Operational seed is demo-scale ([INN-55](https://linear.app/innov8-health/issue/INN-55)): 24 workers, 200 patients plus PAT-002391, 200 access events. Do not re-run the historical 10k/100k volumes on the free plan. Runbook: root `README.md` and `convex/README-seeding.md`.

## Done (live demo path so far)

- **INN-35** — `AuditLogService` (`convex/lib/services/auditLogService.ts`), `requireSession`, `requireRole`. Login audits `UserLoggedIn`.
- **INN-36** — `PatientDiscoveryService` (`convex/lib/services/patientDiscoveryService.ts`) + `convex/patients.ts`. Search audits `PatientSearched` even when there are no hits, as long as a lookup ran (INN-56); discovery returns identity + record existence only.
- **INN-47** — password reset tokens (hashed, single-use, 15 min); sessions 30 min by default, 7 days with Keep me logged in (INN-54); suspended accounts rejected on every call.
- **INN-38** — `RiskScoringService` (`convex/lib/services/riskScoringService.ts`): pure, explainable `RiskBreakdown` (`scoreAccessRequest` return type) with reasons and a factors snapshot. Treatment by Ibrahim → 8 ALLOW; ≥ 500-record harvest → 94 BLOCK.
- **INN-37** — `AccessControlService` (`convex/lib/services/accessControlService.ts`) + `convex/accessRequests.ts`: AccessRequest and Decision aggregates are live; `AccessRequested` and outcome events are audited.
- **INN-40** — `RecordExchangeService` (`convex/lib/services/recordExchangeService.ts`) + `convex/records.ts`: permitted fields only, target facility only, after ALLOW or a live emergency grant; `RecordViewed` audited.
- **INN-39** — `AlertService` (`convex/lib/services/alertService.ts`) + `convex/alerts.ts`: every BLOCK raises a high-severity SecurityAlert and `SecurityAlertRaised`; officers acknowledge/close (status only, never deleted).
- **INN-41** — `EmergencyAccessService` (`convex/lib/services/emergencyAccessService.ts`) + `convex/emergency.ts`: justified, server-fixed 15-minute grants; `EmergencyGranted`, medium SecurityAlert, scheduled `EmergencyExpired`, early `EmergencyRevoked`. A request's grant, not its decision, governs record release once one exists.
- **INN-42** — AuditEvent read model (`convex/audit.ts`): role-scoped, paginated, newest-first by `createdAt`; still append-only (no update/delete path). Logout, password change, password reset, and profile update are audited (INN-58).
- **INN-43** — Dashboard read models (`convex/dashboards.ts`): bounded summaries over AccessRequest, Decision, EmergencyAccess, SecurityAlert, and AuditEvent, plus the Facility list.
- **INN-51** — Decision validity: an ALLOW authorises record release for 24 hours from `decidedAt`; later attempts are refused and recorded as `AccessExpired`.
- **INN-54** — Login failures return a form error (no overlay); Keep me logged in is a 7-day session; seed non-harvest `recordCount` is 1.
- **INN-44** — Step-up on VERIFY: the requester re-enters their password to turn the Decision into ALLOW; three failures turn it into BLOCK with a SecurityAlert. Audited as `StepUpCompleted` / `StepUpFailed`.
- **INN-50** — Acknowledge and close of SecurityAlerts are audited as `SecurityAlertAcknowledged` / `SecurityAlertClosed` (officer as actor).
- **INN-55** — Demo-scale seed (24 workers, 200 patients plus PAT-002391, 200 access events) and batched wipe. Historical §14 10k/100k volumes must not be run on the Convex free plan.
- **INN-52** — Facility scope for hospital admins: AuditEvents and SecurityAlerts are indexed by the facilities they involve (actor's facility, request source/target), so a hospital admin reviews only their facility's activity. Security officers and system admins keep the exchange-wide view.
- **INN-45** — ConsentService: a Consent lets one Facility request a Patient's records held at another; missing consent makes a single-patient, non-emergency cross-facility Decision VERIFY. Recorded by clinicians, revoked by reviewers, audited as `ConsentRecorded` / `ConsentRevoked`.
- **INN-53** — FacilityStats: stored worker and patient totals per Facility, updated whenever a user or patient is created or changes facility.
- **INN-46** — Patient portal: a User with role `patient` is linked to one Patient via `users.patientId` (seeded Chioma → PAT-002391). `getPatientDashboard` returns that identity, home Facility, and a bounded list of AuditEvents that name them. Clinician sessions cannot read it as the patient.
- **INN-57** — Demo Users are created by seed (`internal.auth.ensureDemoUsers`). Public login does not insert users; a suspended demo account stays suspended.
- **INN-60** — User-facing validation throws `ConvexError({ code, message })` so production keeps the payload. The client reads `error.data`, not a substring of `error.message`.
- **INN-65** — Unused `requireUnused*` uniqueness helpers were removed from `invariants.ts`. Seed still skips duplicate facility codes, patient public ids, and worker ids by lookup. One Decision per AccessRequest is still enforced by `.unique()` on `accessDecisions.by_requestId`.
- **INN-68** — Sidebar destinations follow role (clinician vs security/admin vs patient). Mixed patient + clinical roles see the clinician dashboard.
- **INN-63** — SecurityAlerts filtered by status are ordered by `createdAt` (index `by_status_createdAt`), matching the unfiltered list.

## Next (live demo path)

The MVP demo path is live end to end. Remaining work is review-found bugs after INN-60. INN-5–INN-17 and INN-34 stay **Canceled**; open new tickets instead of reviving those ids.

## Entities (MVP)

- **Facility**: code, name, city (FMC Lagos, FMC Abuja, optional Abeokuta)
- **User**: existing users table (email, roles, hospital, department, profile, accountStatus, optional `patientId` for the patient portal)
- **Session**: existing sessions table (30-minute TTL, or 7 days when Keep me logged in is checked)
- **PasswordResetToken**: userId, tokenHash, expiresAt, usedAt (INN-47)
- **Patient**: publicId (`PAT-002391`), homeFacilityId, demographics (synthetic), identifiers for search
- **RecordIndex**: patientId, facilityId, recordTypes[] — **existence only**, not full chart
- **ClinicalSummary**: permitted fields after ALLOW (summary, allergies, medications, diagnoses)
- **AccessRequest**: actor, session, sourceFacility, targetFacility, patient, purpose, recordTypes, time
- **AccessDecision**: requestId, outcome (`ALLOW` | `VERIFY` | `BLOCK`), riskScore, reasons[]
- **EmergencyAccess**: requestId, justification, expiresAt, grantedBy
- **Consent**: patientId, facilityId (granted to), patientFacilityId (records held at), status, note, recordedBy, grantedAt, expiresAt (INN-45)
- **SecurityAlert**: decisionId, severity, status, message
- **AuditEvent**: actor, action, entity, details, session, timestamp, optional `patientId` when the event names a patient

## Value objects

- **FullName**: `{ firstName, middleName?, lastName }`
- **Purpose**: `treatment` | `emergency` | `referral` | `follow-up` | `administrative`
- **RecordType**: `medical_summary` | `allergies` | `medications` | `diagnoses`
- **RiskBreakdown**: `{ score: 0-100, outcome, reasons: string[], factors: { role, purpose, sameHospital, recordCount } }` — ALLOW < 40, VERIFY 40–79, BLOCK ≥ 80
- **DecisionOutcome**: `ALLOW` | `VERIFY` | `BLOCK`

## Aggregates

- **UserAggregate** — identity, roles, facility assignment, sessions
- **FacilityAggregate** — participating hospital; no point-to-point coupling
- **PatientIdentityAggregate** — cross-facility identity; search returns identity + record *existence*
- **AccessRequestAggregate** — purpose, record types, actor, session; never skip this path
- **DecisionAggregate** — risk + ALLOW/VERIFY/BLOCK; reasons required
- **EmergencyAccessAggregate** — works without completed consent; must be justified, short-lived, audited
- **RecordExchangeAggregate** — simulated federation (Lagos data ≠ Abuja data)
- **AuditAggregate** — login, search, request, decision, view, emergency, alert

## Domain services

- **PatientDiscoveryService** — identify patient; disclose existence, not contents — *implemented (INN-36)*
- **AccessControlService** — RBAC + hospital, purpose, relationship — *implemented (INN-35 session/role, INN-37 patient/facility/record-type resolution)*
- **RiskScoringService** — explainable score; treatment + known relationship ≈ 8; 500-record harvest ≈ 94 — *implemented (INN-38); used by `createAccessRequest` (INN-37)*
- **RecordExchangeService** — fetch only permitted fields after ALLOW — *implemented (INN-40); honours live emergency grants on the same request*
- **EmergencyAccessService** — break-glass grant/revoke/expire — *implemented (INN-41)*
- **AlertService** — notify security on BLOCK / emergency — *implemented for BLOCK (INN-39) and break-glass (INN-41)*
- **AuditLogService** — append-only events — *implemented (INN-35); read-only trail in INN-42*
- **ConsentService** — active consent before ALLOW for cross-facility requests — *implemented (INN-45)*

## Domain events (audit)

`UserLoggedIn`, `PatientSearched`, `AccessRequested`, `AccessAllowed`, `AccessChallenged`, `AccessBlocked`, `AccessExpired`, `RecordViewed`, `EmergencyGranted`, `EmergencyExpired`, `EmergencyRevoked`, `SecurityAlertRaised`, `SecurityAlertAcknowledged`, `SecurityAlertClosed`, `StepUpCompleted`, `StepUpFailed`, `ConsentRecorded`, `ConsentRevoked`

## Invariants

- Synthetic data only. Never real patient information.
- Search must not dump record contents.
- Every view goes search → purpose → risk → allow/block → audit.
- BLOCK at high risk must create an alert and an audit event.
- Emergency access still audits and expires.
- Facilities stay separate; one exchange layer, not hospital-to-hospital wiring.

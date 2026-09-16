# Innov8 Health — Domain model (MVP)

Use this as the DDD map for the access layer. The SIMS `DDD_Proposal.md` is only a **method reference** (entities → aggregates → services → events). Do **not** import school, course, enrollment, or grade entities into this repo.

Innov8 is a **secure patient-record access layer**, not an EMR.

Linear: [Innov8 workspace](https://linear.app/innov8-health) · project **Track C Demo Path**. Never use Linear Skilladder.

## Done (foundational UI)

- Session auth, roles, account settings
- Role dashboards with **dummy** cards (not live domain data)
- Healthcare palette and AppShell

## Done (schema + §14 seed)

1. **Adebare** — Convex schema [INN-18](https://linear.app/innov8-health/issue/INN-18) (INN-20…INN-30) on `main`. Plan: `docs/features/INN-18-convex-schema-access-layer/PLAN.md`.
2. **Henry** — synthetic seed [INN-19](https://linear.app/innov8-health/issue/INN-19) (INN-31 patients, INN-32 workers, INN-33 access events). Plan: `docs/features/INN-19-synthetic-datasets-from-section-14/PLAN.md`. Runbook: root `README.md` and `convex/README-seeding.md`.

## Done (live demo path so far)

- **INN-35** — `AuditLogService` (`convex/lib/services/auditLogService.ts`), `requireSession`, `requireRole`. Login audits `UserLoggedIn`.
- **INN-36** — `PatientDiscoveryService` (`convex/lib/services/patientDiscoveryService.ts`) + `convex/patients.ts`. Search audits `PatientSearched`; discovery returns identity + record existence only.
- **INN-47** — password reset tokens (hashed, single-use, 15 min); sessions 30 min; suspended accounts rejected on every call.
- **INN-38** — `RiskScoringService` (`convex/lib/services/riskScoringService.ts`): pure, explainable `RiskBreakdown` (`scoreAccessRequest` return type) with reasons and a factors snapshot. Treatment by Ibrahim → 8 ALLOW; ≥ 500-record harvest → 94 BLOCK.
- **INN-37** — `AccessControlService` (`convex/lib/services/accessControlService.ts`) + `convex/accessRequests.ts`: AccessRequest and Decision aggregates are live; `AccessRequested` and outcome events are audited.
- **INN-40** — `RecordExchangeService` (`convex/lib/services/recordExchangeService.ts`) + `convex/records.ts`: permitted fields only, target facility only, after ALLOW or a live emergency grant; `RecordViewed` audited.

## Next (live demo path)

Do not keep dummy dashboards as the only UI. Remaining path: harvest block + alert (INN-39) → break-glass (INN-41) → audit UI (INN-42) → live dashboards (INN-43). INN-5–INN-17 and INN-34 stay **Canceled**; open new tickets instead of reviving those ids.

## Entities (MVP)

- **Facility**: code, name, city (FMC Lagos, FMC Abuja, optional Abeokuta)
- **User**: existing users table (email, roles, hospital, department, profile, accountStatus)
- **Session**: existing sessions table (30-minute TTL)
- **PasswordResetToken**: userId, tokenHash, expiresAt, usedAt (INN-47)
- **Patient**: publicId (`PAT-002391`), homeFacilityId, demographics (synthetic), identifiers for search
- **RecordIndex**: patientId, facilityId, recordTypes[] — **existence only**, not full chart
- **ClinicalSummary**: permitted fields after ALLOW (summary, allergies, medications, diagnoses)
- **AccessRequest**: actor, session, sourceFacility, targetFacility, patient, purpose, recordTypes, time
- **AccessDecision**: requestId, outcome (`ALLOW` | `VERIFY` | `BLOCK`), riskScore, reasons[]
- **EmergencyAccess**: requestId, justification, expiresAt, grantedBy
- **SecurityAlert**: decisionId, severity, status, message
- **AuditEvent**: actor, action, entity, details, session, timestamp

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
- **EmergencyAccessService** — break-glass grant/revoke — *INN-41*
- **AlertService** — notify security on BLOCK / emergency — *INN-39*
- **AuditLogService** — append-only events — *implemented (INN-35)*
- **ConsentService** — should-have after demo — *INN-45*

## Domain events (audit)

`UserLoggedIn`, `PatientSearched`, `AccessRequested`, `AccessAllowed`, `AccessChallenged`, `AccessBlocked`, `RecordViewed`, `EmergencyGranted`, `EmergencyExpired`, `SecurityAlertRaised`

## Invariants

- Synthetic data only. Never real patient information.
- Search must not dump record contents.
- Every view goes search → purpose → risk → allow/block → audit.
- BLOCK at high risk must create an alert and an audit event.
- Emergency access still audits and expires.
- Facilities stay separate; one exchange layer, not hospital-to-hospital wiring.

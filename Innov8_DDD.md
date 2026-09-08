# Innov8 Health — Domain model (MVP)

Use this as the DDD map for the access layer. The SIMS `DDD_Proposal.md` is only a **method reference** (entities → aggregates → services → events). Do **not** import school, course, enrollment, or grade entities into this repo.

Innov8 is a **secure patient-record access layer**, not an EMR.

Linear: [Innov8 workspace](https://linear.app/innov8-health) · project **Track C Demo Path**. Never use Linear Skilladder.

## Done (foundational UI)

- Session auth, roles, account settings
- Role dashboards with **dummy** cards (not live domain data)
- Healthcare palette and AppShell

## Current focus (schema then seed)

Do not reopen canceled demo issues (search → dashboards) until this is done.

1. **Adebare** — Convex schema [INN-18](https://linear.app/innov8-health/issue/INN-18) and children INN-20…INN-30
2. **Henry** — work document §14 datasets [INN-19](https://linear.app/innov8-health/issue/INN-19): 10k patients (INN-31), 500 workers (INN-32), 100k access events (INN-33)

Later (after schema + seed): discovery, purpose request, risk, authorised view, harvest block, break-glass, audit UI, live dashboards.

## Entities (MVP)

- **Facility**: code, name, city (FMC Lagos, FMC Abuja, optional Abeokuta)
- **User**: existing users table (email, roles, hospital, department, profile, accountStatus)
- **Session**: existing sessions table
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
- **RiskBreakdown**: `{ score: 0-100, reasons: string[] }`
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

- **PatientDiscoveryService** — identify patient; disclose existence, not contents
- **AccessControlService** — RBAC + hospital, purpose, relationship
- **RiskScoringService** — explainable score; treatment + known relationship ≈ 8; 500-record harvest ≈ 94
- **RecordExchangeService** — fetch only permitted fields after ALLOW
- **EmergencyAccessService** — break-glass grant/revoke
- **AlertService** — notify security on BLOCK / emergency
- **AuditLogService** — append-only events
- **ConsentService** — should-have after demo

## Domain events (audit)

`UserLoggedIn`, `PatientSearched`, `AccessRequested`, `AccessAllowed`, `AccessChallenged`, `AccessBlocked`, `RecordViewed`, `EmergencyGranted`, `EmergencyExpired`, `SecurityAlertRaised`

## Invariants

- Synthetic data only. Never real patient information.
- Search must not dump record contents.
- Every view goes search → purpose → risk → allow/block → audit.
- BLOCK at high risk must create an alert and an audit event.
- Emergency access still audits and expires.
- Facilities stay separate; one exchange layer, not hospital-to-hospital wiring.

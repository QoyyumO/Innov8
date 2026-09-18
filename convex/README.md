# `convex/` — Innov8 backend

All backend code lives here. There are no Next.js API routes. Read `_generated/ai/guidelines.md` and `.cursor/rules/convex-*.mdc` before editing.

## Public functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `login`, `logout`, `getCurrentUser`, `updateProfile`, `changePassword`, `requestPasswordReset`, `resetPassword` | Session token `innov8_session_token`; 30-minute sessions |
| `patients.ts` | `searchPatients` (mutation, audited including zero hits), `getPatientDiscovery` (query) | Clinicians only; identity + record existence, never clinical contents |
| `accessRequests.ts` | `createAccessRequest` (mutation, audited, one patient), `simulateBulkHarvest` (demo mutation, server-fixed 500 records), `listMyAccessRequests` (paginated query), `getAccessRequest` (query) | Clinicians create/list their own; record types are role-limited (INN-79 / INN-80); security officers and admins can view any request; no clinical contents |
| `records.ts` | `viewAuthorisedSummary` (mutation, audited `RecordViewed`; expired ALLOW attempts audited `AccessExpired`) | Requester only; ALLOW within 24 hours of the decision, or a live emergency grant; requested sections from the target facility only (`lab_results` after ALLOW, INN-80) |
| `clinicalNotes.ts` | `appendClinicalNoteAfterAllow` (mutation), `listClinicalNotesForRequest` (query) | Doctors only; own ALLOW window; append-only synthetic note; `ClinicalNoteAppended` audit |
| `alerts.ts` | `listSecurityAlerts` (paginated query), `acknowledgeAlert`, `closeAlert` (mutations, audited) | Security officers and admins; status transitions only |
| `audit.ts` | `listAuditEvents` (paginated query) | Own events for everyone; reviewers may filter by actor, patient publicId, facility, decision outcome, and `createdAt` range (INN-78); hospital admins stay facility-scoped; read-only |
| `dashboards.ts` | `getClinicianDashboard`, `getSecurityDashboard` (queries; `since` = start of the Lagos day), `getPatientDashboard` (query), `listFacilities` (with worker / patient totals) | Clinicians see their own summary; security officers and system admins see the exchange; hospital admins see their facility; Chioma (patient role, linked by `users.patientId`) sees PAT-002391 identity + bounded access history; any signed-in user lists facilities. All bounded |
| `consents.ts` | `getConsentStatus`, `recordPatientConsent`, `revokePatientConsent`, `listConsents`, `listMyConsents`, `grantMyConsent`, `revokeMyConsent` | Clinicians record for their facility (30 days); reviewers list/revoke in scope; the linked patient lists/grants/revokes their own (INN-77) |
| `stepUp.ts` | `completeVerification` (mutation, audited `StepUpCompleted` / `StepUpFailed`) | Requester's own single-patient VERIFY request; password re-entry → ALLOW; 3 failures → BLOCK + alert |
| `emergency.ts` | `grantEmergencyAccess` (mutation, audited), `getActiveEmergencyAccess` (query), `revokeEmergencyAccess` (mutation, audited) | Clinicians grant; server-fixed 15 minutes (deep dive §8 examples 30; MVP uses 15); holder, security officers, and admins can revoke |

## Internal functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `issuePasswordResetToken` | Demo out-of-band reset token (no email provider) |
| `emergency.ts` | `expireEmergencyAccess` | Scheduled at grant time; audits `EmergencyExpired` unless already revoked; reschedules if it ran early |
| `facilityScopeBackfill.ts` | `start`, `backfillAlertFacilities`, `backfillGrantFacilities`, `backfillAuditEventFacilities` | One-time INN-52 backfill of `alertFacilities` / grant facility ids / `auditEventFacilities`; batched, idempotent |
| `facilityStatsRecount.ts` | `start`, `recountFacility` | INN-53 rebuild of `facilityStats` from users / patients; batched, idempotent |
| `seed.ts` | `seedFacilities`, `seedHealthcareWorkers`, `seedPatientsBatch`, `seedAccessEventsBatch`, `seedDemoDataset`, `clearSeedDataBatch`, `verifyDemoSeed` | Demo-scale seed + wipe; see root `README.md` and `README-seeding.md` |

## Shared code (`lib/`)

- `session.ts` — `requireSession(ctx, token)` (rejects missing/expired tokens and suspended accounts), `publicUser`, session create/delete
- `roles.ts` — `userRole` validator, `requireRole`, `CLINICIAN_ROLES` / `SECURITY_ROLES` / `ADMIN_ROLES`
- `domain.ts` — closed enums (purpose, record type, decision outcome, audit action, …)
- `invariants.ts` — shared assertions (non-empty strings, risk score range, unique ids)
- `authConstants.ts`, `searchLimits.ts`, `password.ts`, `demoUsers.ts`, `demoIds.ts`, `synthetic.ts`
- `services/accessControlService.ts` — resolves patient, source/target facility, and held record types for a request
- `services/alertService.ts` — `raiseBlockAlert` (called on every BLOCK from `accessRequests.ts`), `raiseEmergencyAlert` (every break-glass grant), and alert status transitions
- `services/emergencyAccessService.ts` — break-glass grant, revoke, and expiry; `isLiveGrant` / `listGrantsForRequest` used by record release
- `accessWindow.ts` — client-safe ALLOW validity window (24 h) and expiry helpers
- `dashboardConstants.ts` — client-safe dashboard caps, `startOfLagosDay`, `formatBoundedCount`
- `emergencyConstants.ts` — client-safe grant length, justification limits, and messages
- `riskConstants.ts` — `HARVEST_RECORD_COUNT` / `HARVEST_SCORE`, shared by the risk engine, the harvest mutation, and the UI
- `services/auditLogService.ts` — `appendAuditEvent`, the only way to write `auditEvents`
- `services/patientDiscoveryService.ts` — indexed patient lookup + record existence
- `services/recordExchangeService.ts` — view authorisation (ALLOW, or a live grant when the request has one) and requested-section filtering
- `services/stepUpService.ts` — VERIFY step-up: password check, failure count, ALLOW or escalation to BLOCK
- `consentConstants.ts` — client-safe consent duration, note limits, reasons, and messages
- `services/consentService.ts` — when consent applies, active lookup, record, revoke (INN-45)
- `facilityStats.ts` — stored per-facility worker / patient totals; the only way to insert or re-home users and patients (INN-53)
- `facilityScope.ts` — hospital-admin facility scope: resolve facility, request/alert checks, `alertFacilities` upkeep (INN-52)
- `services/auditFacilityService.ts` — which facilities an audit event involves; writes `auditEventFacilities`
- `stepUpConstants.ts` — client-safe step-up limit and messages
- `services/riskScoringService.ts` — pure `scoreAccessRequest` (no db access); returns `score`, `outcome`, `reasons`, `factors` for `accessDecisions`

## Writing a new domain function

```ts
export const example = mutation({
  args: { token: v.optional(v.string()) /* , ... */ },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, session } = await requireSession(ctx, args.token);
    requireRole(user, CLINICIAN_ROLES);
    // ... indexed reads / writes ...
    await appendAuditEvent(ctx.db, {
      actorId: user._id,
      sessionId: session._id,
      action: "AccessRequested",
      entity: "accessRequests",
      details: {},
    });
    return null;
  },
});
```

## Tests

`npm test` runs `*.test.ts` in this folder with vitest + convex-test (`vitest.config.ts`, `test.setup.ts`).

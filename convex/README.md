# `convex/` — Innov8 backend

All backend code lives here. There are no Next.js API routes. Read `_generated/ai/guidelines.md` and `.cursor/rules/convex-*.mdc` before editing.

## Public functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `login`, `logout`, `getCurrentUser`, `updateProfile`, `changePassword`, `requestPasswordReset`, `resetPassword` | Session token `innov8_session_token`; 30-minute sessions |
| `patients.ts` | `searchPatients` (mutation, audited), `getPatientDiscovery` (query) | Clinicians only; identity + record existence, never clinical contents |
| `accessRequests.ts` | `createAccessRequest` (mutation, audited, one patient), `simulateBulkHarvest` (demo mutation, server-fixed 500 records), `listMyAccessRequests` (paginated query), `getAccessRequest` (query) | Clinicians create/list their own; security officers and admins can view any request; no clinical contents |
| `records.ts` | `viewAuthorisedSummary` (mutation, audited `RecordViewed`; expired ALLOW attempts audited `AccessExpired`) | Requester only; ALLOW within 24 hours of the decision, or a live emergency grant; requested sections from the target facility only |
| `alerts.ts` | `listSecurityAlerts` (paginated query), `acknowledgeAlert`, `closeAlert` | Security officers and admins; status transitions only |
| `audit.ts` | `listAuditEvents` (paginated query) | Own events for everyone; all events (optionally one actor) for security officers and admins; read-only |
| `dashboards.ts` | `getClinicianDashboard`, `getSecurityDashboard` (queries; `since` = start of the Lagos day), `listFacilities` | Clinicians see their own summary; security officers and admins see the exchange; any signed-in user lists facilities. All bounded |
| `emergency.ts` | `grantEmergencyAccess` (mutation, audited), `getActiveEmergencyAccess` (query), `revokeEmergencyAccess` (mutation, audited) | Clinicians grant; server-fixed 15 minutes; holder, security officers, and admins can revoke |

## Internal functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `issuePasswordResetToken` | Demo out-of-band reset token (no email provider) |
| `emergency.ts` | `expireEmergencyAccess` | Scheduled at grant time; audits `EmergencyExpired` unless already revoked; reschedules if it ran early |
| `seed.ts` | `seedFacilities`, `seedHealthcareWorkers`, `seedPatientsBatch`, `seedAccessEventsBatch`, `verifyDemoSeed` | See root `README.md` and `README-seeding.md` |

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

# `convex/` — Innov8 backend

All backend code lives here. There are no Next.js API routes. Read `_generated/ai/guidelines.md` and `.cursor/rules/convex-*.mdc` before editing.

## Public functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `login`, `logout`, `getCurrentUser`, `updateProfile`, `changePassword`, `requestPasswordReset`, `resetPassword` | Session token `innov8_session_token`; 30-minute sessions |
| `patients.ts` | `searchPatients` (mutation, audited), `getPatientDiscovery` (query) | Clinicians only; identity + record existence, never clinical contents |
| `accessRequests.ts` | `createAccessRequest` (mutation, audited), `listMyAccessRequests` (paginated query), `getAccessRequest` (query) | Clinicians create/list their own; security officers and admins can view any request; no clinical contents |

## Internal functions

| File | Functions | Notes |
| --- | --- | --- |
| `auth.ts` | `issuePasswordResetToken` | Demo out-of-band reset token (no email provider) |
| `seed.ts` | `seedFacilities`, `seedHealthcareWorkers`, `seedPatientsBatch`, `seedAccessEventsBatch`, `verifyDemoSeed` | See root `README.md` and `README-seeding.md` |

## Shared code (`lib/`)

- `session.ts` — `requireSession(ctx, token)` (rejects missing/expired tokens and suspended accounts), `publicUser`, session create/delete
- `roles.ts` — `userRole` validator, `requireRole`, `CLINICIAN_ROLES` / `SECURITY_ROLES` / `ADMIN_ROLES`
- `domain.ts` — closed enums (purpose, record type, decision outcome, audit action, …)
- `invariants.ts` — shared assertions (non-empty strings, risk score range, unique ids)
- `authConstants.ts`, `searchLimits.ts`, `password.ts`, `demoUsers.ts`, `demoIds.ts`, `synthetic.ts`
- `services/accessControlService.ts` — resolves patient, source/target facility, and held record types for a request
- `services/auditLogService.ts` — `appendAuditEvent`, the only way to write `auditEvents`
- `services/patientDiscoveryService.ts` — indexed patient lookup + record existence
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

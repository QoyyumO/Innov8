# INN-52: Scope hospital admin views to their own facility — Implementation Plan

**Git branch:** `INN-52-facility-scoped-admin-views`

## Context

`hospital_admin` users were treated like exchange-wide reviewers. They saw every facility's audit trail (INN-42), alerts (INN-39), request details, and security-dashboard numbers (INN-43), and could revoke any break-glass grant (INN-41). A hospital admin should only see activity involving their own facility. Security officers and `system_admin` keep the exchange-wide view. Stacked on INN-50 (#17); owner Adebare.

Decisions (agreed with Adebare):
- **In scope for a hospital admin:** their own staff's actions, plus every request (and its decision, alert, break-glass grant, and audit events) whose **source or target** is their facility.
- **Facility:** `users.facilityId`, falling back to the facility whose name matches `users.hospital` (the rule access requests already use). No match → the admin sees nothing.

---

## Scope

- [x] `getReviewScope` in `convex/lib/roles.ts`: `global` (security officer, system admin), `facility` (hospital admin), or `none`
- [x] `convex/lib/facilityScope.ts`: resolve the admin's facility; scope checks for requests and alerts; maintain `alertFacilities`
- [x] New tables `auditEventFacilities` and `alertFacilities` (one row per facility an item involves), each indexed by facility plus time (and by action, actor, or status), so admin lists stay single indexed, paginated reads
- [x] `accessRequests` indexes `by_sourceFacilityId_requestedAt` / `by_targetFacilityId_requestedAt` for the admin dashboard
- [x] `appendAuditEvent` writes the facility rows for every event (`auditFacilityService`); `raiseBlockAlert` / `raiseEmergencyAlert` link alerts to their request's facilities; status changes keep `alertFacilities.status` in sync
- [x] Scope applied to `listAuditEvents`, `listSecurityAlerts`, `acknowledgeAlert` / `closeAlert` (out-of-scope alerts look "not found"), `getAccessRequest`, `revokeEmergencyAccess`, and `getSecurityDashboard`
- [x] Seed writes through `appendAuditEvent` and links seeded alerts
- [x] One-time backfill for existing data: `npx convex run facilityScopeBackfill:start`
- [x] Page copy on `/audit`, `/security`, and the admin dashboard names the admin's facility
- [x] Tests in `convex/facilityScope.test.ts`
- [x] Docs updated

---

## Implementation

### Which facilities an audit event involves

The facilities are the union of:
- the actor's facility (so an admin sees their own staff's sign-ins and searches);
- the source and target of the request the event is about, found via `details.requestId`, an `accessRequests` entity, or a decision / grant entity;
- the facilities of the alert, for `securityAlerts` events.

An exchange security officer (no hospital) revoking an Abuja clinician's grant therefore still shows up in the Abuja trail.

### Why lookup tables

Filtering after an unscoped `.paginate()` would return short or empty pages. With one row per facility, an admin's audit trail and alert queue are each a single index range with normal pagination. Both tables are write-once, apart from `alertFacilities.status`, which follows the alert. The audit log itself stays append-only; `auditLogService` still exports only `appendAuditEvent`.

### Admin dashboard

Requests to or from the facility are read from the two new `accessRequests` indexes (each capped) and merged.
- **Blocked today:** counts BLOCK decisions on today's requests.
- **Active break-glass:** live grants to or from the facility, via `emergencyAccess` indexes `by_sourceFacilityId_expiresAt` / `by_targetFacilityId_expiresAt` (facility ids copied onto the grant at insert; backfill patches older rows).

---

## Open questions

- [ ] Hospital admins can still open `/security` and `/audit` for other facilities' IDs only through direct URLs; those return "not found" / empty. A friendlier message is out of scope.

# INN-42: Audit trail query and /audit UI — Implementation Plan

**Git branch:** `INN-42-audit-trail`

## Context

The audit log is append-only and already written by login, search, request, decision, view, break-glass, and alert code (INN-35 → INN-41), plus about 100k seeded events (INN-33). Nothing reads it yet, and the sidebar's **Audit trail** link 404s. This ticket adds a paginated, role-scoped read path and a read-only `/audit` page. Unblocked; owner Adebare.

---

## Scope

- [x] `convex/audit.ts` — `listAuditEvents` (paginated query; optional `action` and `actorId` filters)
- [x] Everyone sees their own events; security officers and admins see all events and may filter by any actor
- [x] Newest-first by `createdAt` for every filter combination, using indexes only (seeded events are backdated, so `_creationTime` order is not enough)
- [x] No update or delete functions; no edit or delete UI
- [x] `/audit` page with `AuditEventsTable`: time, actor, action, entity, details summary; action filter; reviewers can filter to one actor
- [x] Tests in `convex/audit.test.ts`, including a demo walk that shows search, request, allow, view, harvest block, alert, and emergency in the log
- [x] Docs updated (and `docs/README.md` INN-37…INN-41 rows marked done)

---

## Implementation

### Part A — Backend

#### A1. Indexes (`convex/schema.ts`)

Replace the single-field `by_actorId` / `by_action` on `auditEvents` (no callers) with:

- `by_actorId_createdAt` — `["actorId", "createdAt"]`
- `by_action_createdAt` — `["action", "createdAt"]`
- `by_actorId_action_createdAt` — `["actorId", "action", "createdAt"]`

Keep `by_createdAt` (used by the unfiltered reviewer view).

#### A2. `listAuditEvents`

- Args: `token`, `paginationOpts`, `action?: auditAction`, `actorId?: string`.
- `requireSession`; auth errors return an empty page (same pattern as `listSecurityAlerts`).
- Reviewer = security officer or admin. Non-reviewers are always scoped to themselves; asking for another actor → `PERMISSION_DENIED_MESSAGE`. A malformed `actorId` returns an empty page.
- Index choice: actor + action → `by_actorId_action_createdAt`; actor only → `by_actorId_createdAt`; action only → `by_action_createdAt`; neither → `by_createdAt`. Always `.order("desc").paginate()`.
- Row view: `eventId`, `createdAt`, `action`, `entity`, `entityId`, `details`, `actor` (`actorId`, `name`, `email`, `hospital`, or null). Actors are loaded once per page (cached map).

### Part B — Frontend

#### B1. `src/app/(authenticated)/audit/page.tsx`

Breadcrumb + `ComponentCard`. Copy explains the scope (your own events vs all events). Reads `?actorId=` so reviewers can link to one person's trail.

#### B2. `audit/_components/AuditEventsTable.tsx`

`usePaginatedQuery`, 25 per page, **Load more**. Action filter via the shared `Select`. Actor name is a link to `/audit?actorId=…` for reviewers; a "Showing one person" note with a clear link. Details rendered as short `key: value` pairs. Links to `/requests/[id]` when the event names a request.

#### B3. `_components/auditLabels.ts`

Human labels and badge colours per action.

---

## Open questions

- [ ] Alert acknowledge/close are still not audited (no `auditAction` value). Out of scope; follow-up ticket.
- [ ] Facility-scoped views for hospital admins (INN-52). Out of scope; reviewers see all events for now.
- [ ] Audit `details` are the stored payload (metadata, including break-glass justification), not clinical sections. The table truncates values to 80 characters. Intentional.

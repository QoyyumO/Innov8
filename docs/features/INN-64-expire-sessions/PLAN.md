# INN-64 + INN-61: Expire sessions for real — Implementation Plan

**Git branch:** `INN-64-expire-sessions`

## Why these are one ticket

Both came out of the 2026-09-17 review and both point at the same fix. INN-64 says "consider scheduling per-session expiry at insert time, which also resolves INN-61". INN-61's preferred option is "materialise expiry: schedule a mutation at `expiresAt` … this pairs naturally with the session-cleanup ticket". Doing them separately would mean either building the scheduler twice or shipping a worse fix for one of them.

**INN-61** — `getUnexpiredSession` compared `expiresAt` against `Date.now()` inside a query. A subscribed query is not re-run because the clock moved, so a tab left open kept serving patient data and audit history from a cached result after the session should have ended, until some unrelated write happened to invalidate it. Mutations were fine; reads were not. On a records-access product that is an authorisation gap.

**INN-64** — expired sessions were never removed. `sessions.by_expiresAt` existed with no callers and there was no `convex/crons.ts`. Both cleanup helpers read the whole per-user set with `.collect()`, so an account with a long login history could make `resetPassword` exceed its transaction limits and *fail* — leaving the user locked out with every stale session still valid.

---

## Scope

- [x] Sessions delete themselves at `expiresAt`, so expiry is a write and reads are reactive
- [x] No unbounded `.collect()` in `convex/lib/session.ts` or `convex/auth.ts`
- [x] A cron backstop for rows whose scheduled job never ran
- [x] A password reset succeeds for a user with far more sessions than one page
- [x] Tests that advance time and assert the read flips

---

## Implementation

### `createSession` schedules its own expiry

`createSession` now takes the mutation `ctx` rather than `ctx.db`, and schedules `internal.sessions.expireSession` at `expiresAt`. That delete is the whole point: it is a **write**, so Convex re-runs every subscribed query and the session stops working the moment it lapses.

`expireSession` re-reads the row first. Missing → `skipped` (logout or a sweep beat it). Still in the future → reschedule and follow it, rather than deleting a session that is currently valid.

### Bounded cleanup

`purgeUserSessions` pages with `.take(SESSION_CLEANUP_BATCH)` instead of `.collect()`, optionally keeping one token, and returns whether it stopped at the page cap. `deleteAllUserSessions` and `deleteOtherUserSessions` keep their signatures' meaning but hand any remainder to `internal.sessions.purgeSessionsForUser`, which continues on the scheduler. So the reset mutation is bounded no matter how many rows exist.

The loop stops when a page contains only the kept session — otherwise the next `.take` would return that same row forever.

`convex/auth.ts` gets the same treatment for `passwordResetTokens` in `deleteUserResetTokens` and `hasRecentResetToken`.

### The cron is a backstop, not the mechanism

`convex/crons.ts` sweeps `by_expiresAt` hourly. It exists for rows whose scheduled job never ran — sessions created before this shipped, or a job lost to a deploy — not for normal expiry. It reschedules itself while rows remain, so the hour is a floor on how long a missed row lingers, not a cap on how many it clears.

### The clock check stays, deliberately

`getUnexpiredSession` still compares `expiresAt` to `Date.now()`, a partial deviation from INN-61's "no `Date.now()` in a helper reachable from a query".

Being precise about what it does and does not buy, because it is easy to overclaim: **it does not cover the window between `expiresAt` and the scheduled delete firing.** `Date.now()` is not part of the query's read set, so an already-subscribed tab is not re-evaluated and the check never runs for it — which is the exact case INN-61 was filed about. The check only bites on a *fresh* evaluation: a new subscriber, or a mutation going through `requireSession`. Those are worth covering, so it stays.

It is safe to keep because it is monotonically restrictive: it can only reject a session *earlier* than the row's deletion, never keep one alive longer. Removing it would widen the gap for no gain.

So is INN-61 fixed? Yes, in the way that matters. The failure mode changes from "stale until some unrelated write happens to invalidate the query", which is unbounded, to "stale until the scheduled delete fires", which is scheduler latency. That is also the remedy `convex/_generated/ai/guidelines.md` itself recommends for time-based state.

The one case where the window is not small is a session whose scheduled job never ran — see the deploy note below.

This matches the pattern already proven in this repo: `expireEmergencyAccess` is scheduled at the grant's expiry *and* `isLiveGrant` still checks the clock.

### One-off step at deploy

Every session that is live when this deploys has no scheduled expiry job, because it was created before `createSession` scheduled one. Nothing will re-evaluate a subscribed query for those, so until a sweep removes the row, such a tab can keep rendering records past expiry — bounded by the cron interval, which is why it is 15 minutes rather than an hour.

Run the sweep once by hand after deploying rather than waiting for the first tick:

```
npx convex run sessions:sweepExpiredSessions '{}'
```

---

## Testing

`convex/sessions.test.ts`:

- Login schedules exactly one `sessions:expireSession` at the session's `expiresAt`.
- **The one that matters:** advance past expiry, run the scheduled job, and assert the row is gone and `getCurrentUser` returns null — with no other write in between. The row being deleted is what proves a subscriber is invalidated.
- `expireSession` reschedules rather than deleting a session whose expiry moved, and is a no-op on an already-deleted row.
- The sweep pages, reschedules while more remain, and never touches unexpired rows.
- A password reset with three pages' worth of sessions succeeds and clears them all.
- A password change clears other sessions and keeps the caller's.
- A purge past the page cap is finished by the scheduled continuation — asserted through `resetPassword` and `changePassword` themselves, not just the internal mutation. That distinction matters: with only the internal-mutation test, deleting the `scheduler.runAfter` from either revocation path left the whole suite green while stale sessions survived a password reset for good.

Deliberate-break: removing the `scheduler.runAt` from `createSession` fails the two INN-61 tests; shrinking the page size so the cap is hit fails the INN-64 cleanup tests; removing the continuation from either `deleteAllUserSessions` or `deleteOtherUserSessions` fails its revocation test.

Two existing tests needed updating, both because the new scheduled job is real:

- `emergency.test.ts` asserted the *total* scheduled-function count was 1. It now filters for `emergency:expireEmergencyAccess`.
- `facilityScope.test.ts` runs every timer mid-test, which now also expires the admin's session — correct behaviour — so it signs in again afterwards.

---

## Note for the reviewer

`convex/_generated/api.d.ts` is **hand-edited** in this branch. `npx convex codegen` needs a reachable deployment and this environment has none, so the new modules were added by hand following the existing pattern (lexicographic order, `import type * as x from "../x.js"`, one module-map entry).

Three modules were added, not two. `crons` and `sessions` are this branch's. The third, `lib/loginForTests`, was **already missing on `main`** — it landed in `4151586` (INN-57) without the generated file being regenerated. Real codegen includes every `.ts` under `convex/` except `_generated/`, `schema.ts`, dotfiles, and basenames with more than one dot (which is what excludes `*.test.ts` and `test.setup.ts`), so it does emit that module. Adding it here means the next real `npx convex dev` produces no surprise diff.

It typechecks and the suite passes, but this is a generated file edited by hand — worth a second pair of eyes.

---

## Open questions

- [x] Should `resetPassword` block until every session is gone? No — it deletes up to 500 rows synchronously and schedules the rest, so it cannot fail on transaction limits.

  The honest version of the trade-off: holding 500+ live sessions **is** reachable. `PERSISTENT_SESSION_DURATION_MS` is 7 days and nothing rate-limits `login`, so anyone who can authenticate can script that many and hold them — which is exactly the attacker `resetPassword` exists to evict. What makes it acceptable is the *duration*, not the unreachability: the tail is one `runAfter(0)` hop per extra 500 sessions, each hop clearing another 500, so even an absurd number closes in seconds. Tests cover both revocation paths past the cap.
- [ ] A `users.sessionsInvalidatedAt` stamp would make "log out everywhere" O(1) and exact, closing that window entirely. It is a schema change plus a check on every `requireSession` read path, so it belongs in its own ticket — filed as INN-70.
- [ ] Nothing cancels a session's scheduled job when the row is deleted early. The job is harmless (it finds no row and returns `skipped`), but one pending job per login lives until its `expiresAt` — up to 7 days for a persistent login. Fine at demo scale; it would need a job id on the row to cancel.

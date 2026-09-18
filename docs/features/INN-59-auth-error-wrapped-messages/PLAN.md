# INN-59: isAuthErrorMessage never matches a client-side Convex error — Implementation Plan

**Git branch:** `INN-59-auth-error-wrapped-messages`

## Context

INN-60 moved auth throws to `ConvexError` and `toUserFacingError` reads `error.data`. A wrapped **plain** Convex client error still looks like `[CONVEX M(…)] … Uncaught Error: Your session has expired…`. `isAuthErrorMessage` was removed; substring matching of the known auth messages is still needed for that wrapped `Error` shape (dev, and any remaining plain throws). Server list queries already swallow via `isAuthAppError` codes.

---

## Scope

- [x] Restore `isAuthErrorMessage` / `findAuthErrorMessage` with `message.includes(known)`
- [x] `toUserFacingError` returns the known auth message after `readAppError` fails
- [x] Tests: raw message and wrapped `[CONVEX M(…)] Uncaught Error: …` shape
- [x] Server `isAuthAppError` callers unchanged

---

## Implementation

### Part A — `convex/lib/authConstants.ts` + `src/lib/userFacingError.ts`

### Part B — `convex/lib/authConstants.test.ts`

---

## Open questions

- None. Do not revive `findXInputError`. Production still needs `ConvexError` (INN-60).

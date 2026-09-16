# INN-48: Broken build: npm ci fails on a clean checkout — Implementation Plan

**Git branch:** `INN-48-broken-build-npm-ci`

## Context

High-priority install/build bug (Eno / code review). `prepare` runs `cd .. && husky install sims/.husky`. Husky is not a dependency, and `sims/` is a sibling folder from another local layout. Fresh `npm ci` therefore exits non-zero (`husky: not found`) and will break Vercel/CI. Separately, `tsc --noEmit` fails on a bare clone until Next has generated `.next/types` (`LayoutProps` in `src/app/layout.tsx`).

---

## Scope

- [x] Remove the broken `prepare` / Husky script (do not add Husky; this repo has no `.husky`)
- [x] Run `next typegen` before `tsc --noEmit` so `npm run check` works on a clean clone
- [x] Confirm `npm ci` no longer fails because of `prepare`

---

## Implementation

### Part A — Install scripts

#### A1. `package.json`

Delete the `prepare` script. Do not add `husky`. This repo is a standalone clone, not `sims`.

### Part B — Typecheck order

#### B1. `type-check` script

`"type-check": "next typegen && tsc --noEmit"` so `LayoutProps` and other generated Next types exist before `tsc`. Keep `"check": "npm run lint && npm run type-check"`.

---

## Open questions

- [x] Husky in this repo: drop it. There is no Innov8 git-hooks directory to install.

---
name: review-branch-vs-main
description: Run a systematic code review of the current branch against main—every changed file, .cursor/rules, KISS/DRY, security, and performance. Use when reviewing a PR branch, before merge, or when the user asks for a branch diff review or audit vs main.
---

# Review branch vs `main`

Use this workflow when the user wants a **full** review of their Git branch compared to **`main`**, with no skipped files and explicit criteria.

## When to use

- Pre-merge or PR review
- “Review my branch against main”
- Security or performance pass on a feature branch
- Auditing compliance with repo rules

## Prerequisites

- Branch to review is checked out (or the user specifies which branch to compare).
- Base branch is **`main`** unless the user names another; substitute that name everywhere below.
- `main` exists locally or after `git fetch origin <base>`.
- If git cannot be run, ask for `git diff --name-status <base>...HEAD` (and `--stat`) output.

## Workflow

```markdown
You are performing a **full code review** of the current Git branch against **`main`**.

### Scope — verify every changed file

1. Run: `git fetch origin main` (if needed) and `git merge-base main HEAD` then `git diff --name-status main...HEAD` (three-dot) to list **all** files changed on this branch vs the merge base with `main`.
2. Also run: `git diff --stat main...HEAD` for size/context.
3. For **each path** in the diff list (added, modified, deleted), either (a) review it explicitly in your write-up, or (b) state “intentionally N/A” with one line why. **Do not skip files** without accounting for them.

### Review criteria (apply to every relevant change)

#### 1. Repository rules — `.cursor/rules/`

Read and enforce **all** rule files under `.cursor/rules/` in this repo, including at minimum:

- `project-overview.mdc`, `react-and-pages.mdc`, `convex-functions.mdc`, `convex-client.mdc`
- `async-await-preference.mdc`, `nullish-coalesce.mdc`, `variable-naming.mdc`
- `convex-validators.mdc`, `public-document-shapes.mdc`
- `convex-queries.mdc`, `convex-indexes.mdc`
- `branch-naming.mdc`, `linear-innov8.mdc`, `innov8-next-tasks.mdc`

Also align with **`AGENTS.md`** and `convex/_generated/ai/guidelines.md` for Convex edits.

Flag any violation with **file:line** (or best effort) and the rule name.

#### 2. Engineering best practices

- **KISS**: unnecessary complexity, over-abstraction.
- **DRY**: duplicated logic (especially Convex helpers vs client); share only where it reduces risk.
- **Consistency**: match surrounding code in `convex/` or the same route group.
- **Maintainability**: Convex vs UI boundaries, `publicUser`-style projections, typing via `v.*`.
- **Tests**: note gaps only if the change is high-risk and similar paths already have tests.

#### 3. Security

- **AuthZ/authN**: session token validation; do not authorize from a client-supplied `userId`.
- **RBAC + facility**: role and hospital/facility checks; no cross-facility chart dump on search.
- **Secrets**: no `hashedPassword` or env tokens in client responses.
- **Synthetic data only**: never real patient information.

#### 4. Performance

- **Unbounded reads**: `.collect()` or `.filter()` on tables that can grow (patients, auditEvents, accessRequests).
- **N+1**: loops of `ctx.db.get` / `useQuery` per row.
- **Seed**: 10k/100k inserts must be batched.
- **React**: avoidable re-renders; prefer `useQuery` over fetch-in-`useEffect`.

#### 5. Regression analysis

- **Auth**: demo logins (`ibrahim@fmc.abuja.ng`, etc.) still work; `users` new fields are `v.optional` until backfilled.
- **Shared helpers**: `validateSessionToken`, `publicUser`, `permissions.ts` callers still correct.
- **Schema**: new required fields on populated tables; `_creationTime` in a custom index.
- **Error handling**: try/catch or `Promise.all` refactors dropping previous error paths.
- **Information leaks**: raw Convex errors or clinical summaries returned on discovery.

### Output format

1. **Summary** (few bullets): what the branch does and overall risk level.
2. **Files reviewed**: every path from `git diff --name-status main...HEAD` → **Pass / Issue / N/A**.
3. **Issues**: grouped by **Severity** (Blocker / Major / Minor / Suggestion). Each issue: **file**, **description**, **criterion**, **recommendation**.
4. **Rules checklist**: short pass/fail per `.cursor/rules/*` consulted.
5. **Regression analysis**: for every changed file. If none, state "No regressions identified."
6. **Residual risks / follow-ups**.

Use evidence from the actual diff; do not speculate beyond what the code shows.
```

## Notes

- **Three-dot diff** (`main...HEAD`) lists changes since the branch diverged from `main`.
- If the repo uses a different default branch, replace `main` consistently.

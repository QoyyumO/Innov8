---
name: create-pull-requests
description: Guide for creating well-structured pull requests following Innov8 conventions. Use when creating PRs, writing PR descriptions, or when the user asks for help with pull requests.
---

# Creating Pull Requests

When creating a pull request for Innov8 Health, follow this structure and process.

## PR Description Structure

### 1. What does this PR do?

- Start with a concise one-line summary of the main change
- List key changes as bullet points when multiple features/fixes are included
- For bug fixes: briefly state the cause and the change
- For schema/seed: name the tables and whether demo logins still work
- Focus on the "what" and "why"

**Examples:**

- "Adds the `facilities` table and indexes so patients can store `homeFacilityId`."
- "Seeds 10,000 synthetic patients including PAT-002391 at FMC Lagos."

### 2. How should the PR be tested?

- Numbered steps a reviewer can follow
- Demo login when UI is involved: `ibrahim@fmc.abuja.ng` / `password123`
- For Convex: `npx tsc --noEmit`, confirm `npx convex dev` push is clean, check dashboard data if seeded
- Happy path and edge cases (missing session, wrong role)

### 3. What Linear ticket is this related to?

- Always link: `[INN-XXX](https://linear.app/innov8-health/issue/INN-XXX)`
- PR title starts with the ticket number: `INN-XXX: Brief description`
- Innov8 workspace only — never Skilladder (`SKI-XXX`)

## Creating the PR

### Before creating

1. Not on `main`
2. `git push -u origin HEAD`
3. `npm run check` (eslint + `tsc --noEmit`)
4. Tested locally; Convex schema changes pushed with `npx convex dev` / `--once` only after the user agrees if it is a shared deployment

### Verify branch name and ticket

1. `git branch --show-current`
2. Expect `INN-XXX-description` (no username prefix)
3. If there is no `INN-XXX`, ask: "What is the Linear ticket number for this PR? (e.g. INN-21)"
4. Use that number in the PR title and body

### Using gh CLI

```bash
git push -u origin HEAD

gh pr create --title "INN-XXX: Brief description" --body "$(cat <<'EOF'
#### What does this PR do?

[Main summary and bullet points]

#### How should the PR be tested?

1. ...
2. ...

#### What Linear ticket is this related to?

[INN-XXX](https://linear.app/innov8-health/issue/INN-XXX)

EOF
)"
```

## PR Title Conventions

- Format: `INN-XXX: Brief description`
- Examples:
  - `INN-21: Add facilities table and indexes`
  - `INN-31: Seed 10,000 synthetic patients including PAT-002391`
  - `INN-30: Optional facilityId and worker baselines on users`

## Best Practices

1. Test instructions should let anyone verify the change
2. Name real files (`convex/schema.ts`, `convex/seed.ts`, route `_components`)
3. Always link the Innov8 Linear ticket
4. Do not recreate canceled demo-path issues (INN-5–INN-17) in the PR unless the ticket says so

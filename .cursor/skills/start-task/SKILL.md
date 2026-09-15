---
name: start-task
description: Start a task from a Linear Innov8 ticket by creating an implementation plan in docs/features/. Use when the user provides a ticket number (e.g. INN-XXX) and wants to begin implementation.
---

Start a task from a Linear ticket by creating an implementation plan in `docs/features/`.

Usage: `@start-task INN-XXX`

Use Linear **Innov8** only (`project-0-innov8-linear-innov8`, https://linear.app/innov8-health). Never Skilladder.

## Steps

1. **Fetch the ticket** from Linear using the ticket number. Read the full title and description.
2. **Derive the folder name** from the ticket: take the title, lowercase it, strip punctuation, replace spaces with hyphens. Prefix with the ticket ID. Drop `[Adebare]` / `[Henry]` from the slug.
   - Example: `INN-21` + "Facilities table and indexes" → `docs/features/INN-21-facilities-table-and-indexes/`
   - Keep it short — truncate after ~5–6 meaningful words.
3. **Create `docs/features/<slug>/PLAN.md`** with the structure below.
4. If the ticket is Convex schema, seed, or functions: read `convex/schema.ts` and `convex/_generated/ai/guidelines.md` before planning.

## PLAN.md structure

```markdown
# INN-XXX: <Ticket title> — Implementation Plan

**Git branch:** `INN-XXX-<slug>` ← same kebab slug as the folder name, 5–6 meaningful words max, no username prefix

## Context

<2–4 sentences from the ticket. Note owner (Adebare schema vs Henry seed) and blockers.>

---

## Scope

<Checklist mapped to the ticket. Don't invent demo-path UI (search/risk/view) unless the ticket asks.>

- [ ] Item A
- [ ] Item B

---

## Implementation

### Part A — <Area name>

#### A1. <Sub-task>
<File paths, validators, indexes, seed shapes. Be specific.>

---

## Open questions

- [ ] ...
```

## Rules

- Base the plan entirely on the ticket — don't invent requirements
- Use existing file patterns (`convex/`, `src/app/(authenticated)/_components/`, `src/lib/convex.ts`)
- Schema tickets: `defineTable` style matching `convex/schema.ts`; seed tickets: insert those shapes, not spreadsheet `patient_id` columns
- Synthetic data only. Never real patient information
- Git branch: `INN-XXX-<kebab-slug>` (ticket ALL CAPS, no username prefix). See `.cursor/rules/branch-naming.mdc`

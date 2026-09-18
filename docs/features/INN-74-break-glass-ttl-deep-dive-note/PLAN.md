# INN-74: Align break-glass duration with deep-dive §8 — Implementation Plan

**Git branch:** `INN-74-break-glass-ttl-deep-dive-note`

## Context

Deep dive §8 examples **30 minutes** of emergency access. The MVP server-fixes `EMERGENCY_ACCESS_TTL_MS` at **15 minutes** (INN-41). That is a product choice. The client still must not choose the length.

---

## Scope

- [x] Keep 15 minutes (do not change the constant)
- [x] One sentence in README / AGENTS / constant comment: §8 example was 30; MVP uses 15

---

## Implementation

Comment on `EMERGENCY_ACCESS_TTL_MS`. README break-glass row. AGENTS INN-41.

---

## Open questions

- None. Changing to 30 minutes was the other allowed option; docs-only is the smaller demo-safe choice.

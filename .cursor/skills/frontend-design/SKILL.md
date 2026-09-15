---
name: frontend-design
description: Implement Innov8 UI with the existing healthcare design system. Use when building or restyling pages, dashboards, forms, or components in this app.
---

Implement working UI that matches **this repo’s** healthcare access-layer look, not a new brand and not generic AI aesthetics.

## Design system (already in the repo)

- **Palette**: Deep teal `#005F73` (`brand-500`) for primary actions; charcoal `#212529`; off-white surfaces `#f8f9fa` / `#e9ecef`. Tokens live in `src/app/globals.css`.
- **Type**: Outfit (`font-outfit`). Geist is imported; do not add Inter, Roboto, or Space Grotesk.
- **Shell**: Authenticated pages use `AppShell` / `AppHeader` / `AppSidebar`. Login uses `AuthPageLayout`.
- **Components**: Reuse `Button`, `Alert`, `Input`, `Label`, `MetricCard`, `ComponentCard`, `PageBreadCrumb`, `Badge`, tables, tabs. Extend them; do not fork a parallel kit.
- **Tone**: Calm, clinical, trustworthy. This is a patient-record **access** layer (ALLOW / VERIFY / BLOCK), not a hospital marketing site.

## Before coding

1. Identify the route group: `(authenticated)` vs `(not-authenticated)`.
2. Colocate route UI in `_components/`. App-wide primitives stay in `src/components/`.
3. `"use client"` only when hooks or browser APIs are required.
4. Data: `useAuth()` for the session; `useQuery` / `useMutation` from Convex. Dummy dashboard numbers stay dummy until live queries exist.

## Do

- Tailwind classes using existing tokens (`bg-brand-500`, `text-charcoal`, dark variants already in `globals.css`)
- Light and dark both work (theme toggle is in the header)
- Clear hierarchy for risk, alerts, and audit — readable over decorative
- Accessible labels, focus states, and keyboard-usable forms (see `LoginForm`)

## Do not

- Invent a new color story, font pairing, or “bold experimental” layout
- Purple gradients, glassmorphism-for-its-own-sake, or generic SaaS purple-on-white
- Inline styles when a token exists
- Dump clinical fields on search; discovery is identity + existence only
- Build SIMS/school UI or extra EMR screens outside the current ticket

Match surrounding dashboards (`DoctorDashboard`, `SecurityDashboard`, account settings) so new screens feel like the same product.

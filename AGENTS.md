<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Innov8 Health — Hackathon MVP

NITDA / ICSC Track C: **Safe Access to Patient Records**.

Innov8 Health is a **secure patient-record access layer**, not a hospital management system and not a national EMR. The challenge window is about three weeks. Build one finishable, end-to-end demonstration — not every healthcare workflow.

Use synthetic data only. Never use real patient information.

Full problem, requirements, and architecture notes live in `Innov8_Health_Track_C_Deep_Dive.docx`. When product scope is unclear, prefer that document and this MVP over inventing new features.

## What the MVP must prove

A clinician at one Federal Medical Centre can request another facility's records for a real clinical purpose. The platform evaluates identity, role, purpose, relationship, and behaviour, then **allows**, **challenges**, or **blocks** the request — and leaves an audit trail.

Core sentence:

> Innov8 Health shall authenticate healthcare workers, identify patients across participating facilities, evaluate contextual and behavioural risk for every record-access request, enforce appropriate access decisions, provide controlled emergency access, and maintain an auditable record of all activity.

## Demo scenario (definition of done)

A patient normally treated at **FMC Lagos** travels to **FMC Abuja** and needs care. Walk this path in the UI without extra setup.

| Step | Action | Expected result |
| --- | --- | --- |
| 1. Authenticate | **Dr. Ibrahim**, FMC Abuja, Cardiology, signs in | Session carries identity, hospital, role, and account status |
| 2. Search | Look up **PAT-002391** | Patient is identified. Records exist at FMC Lagos. Contents are **not** dumped automatically |
| 3. Request | Purpose: **Treatment**. Ask for medical summary, allergies, medications, previous diagnoses | Request is recorded with actor, facility, role, record type, purpose, time, and session |
| 4. Evaluate | Identity, role, hospital, purpose, relationship, consent, behaviour | Risk **8/100** → **ALLOW** |
| 5. View | Doctor opens the authorised summary | Only permitted fields are shown |
| 6. Suspicious | Same doctor suddenly requests **500** patient records | Risk **94/100** → **BLOCK**. Security officer is alerted. Event is audited |
| 7. Emergency | Doctor uses break-glass with a justification | Temporary access is granted and **must** be audited |

If a change does not help this demo, it is out of scope for the MVP.

## Build these capabilities

- Authentication for healthcare workers (and later patients, security officers)
- Role and facility-aware permissions (RBAC plus contextual checks)
- Cross-facility patient identity and record **discovery** (existence, not full disclosure)
- Purpose-based access requests (treatment, emergency, referral, follow-up, administrative)
- Contextual decision: **ALLOW / VERIFY / BLOCK**
- Behavioural risk scoring with visible reasons
- High-risk blocking plus a security alert
- Break-glass emergency access: justification, short duration, mandatory audit
- Audit log of login, search, request, decision, view, emergency, and alerts
- Federated exchange **simulation** (separate Lagos / Abuja data, one secure exchange layer)
- Security dashboard for blocked requests, risk, emergency access, and alerts
- Synthetic dataset of patients, workers, hospitals, records, and access events

## Do not build

- A full national EMR or hospital operations suite
- Real-patient data, national ID integration, or live hospital EMR connectors
- Point-to-point hospital coupling (every facility talking to every other facility)
- Production disaster recovery, HSMs, or regulatory certification
- Features that skip the access-decision path (search → purpose → risk → allow/block → audit)

Consent, step-up verification, record writing, deep audit investigation, and a patient dashboard are **should-have**. Implement them only after the demo scenario works end to end.

## Implementation rules

- Prefer a working demonstration over architectural completeness.
- Keep major pieces separable: authentication, access control, consent, risk engine, record exchange, audit.
- Decisions must be explainable: show why risk is high, not only a score.
- Emergency access must still work when normal consent cannot be completed, and must still be justified, time-boxed, and audited.
- Label performance as a target, then measure: 95% of normal access decisions inside 1 second in the decision engine.
- Use free/open-source tools that run on a normal laptop.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

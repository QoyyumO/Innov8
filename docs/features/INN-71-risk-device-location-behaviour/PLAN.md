# INN-71: Risk engine device, location, and historical behaviour — Implementation Plan

**Git branch:** `INN-71-risk-device-location-behaviour`

## Context

§9 wants behavioural context (device, location, historical pattern) without hiding the additive rules. Device from the browser is spoofable, so it is not scored. Demo must stay Ibrahim treatment ALLOW 8 and harvest BLOCK 94.

---

## Scope

- [x] Persist coarse **location** on the request from the **source facility** (trusted), not GPS
- [x] Omit **device** from scoring (untrusted)
- [x] Optional points: location/facility mismatch; request volume in 24h vs worker baseline
- [x] Clinical after-hours is explained with **0 extra points** so Ibrahim night treatment stays 8
- [x] `reasons[]` stay complete; no ML score
- [x] Tests: Ibrahim 8, harvest 94, mismatch and behaviour deviation

---

## Implementation

### Part A — `scoreAccessRequest`

`convex/lib/services/riskScoringService.ts`: `location`, `sourceFacility`, `recentRequestCount`.

### Part B — `recordAccessRequest`

Store `location` as source-facility city; count prior requests in `BEHAVIOUR_WINDOW_MS`.

---

## Open questions

- None. No real geolocation.

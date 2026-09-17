# Feature plans

Implementation plans for Linear Innov8 tickets (`INN-XX`). Each folder is `docs/features/<TICKET>-<slug>/PLAN.md`.

| Folder | Ticket | Status |
| --- | --- | --- |
| [INN-18-convex-schema-access-layer](features/INN-18-convex-schema-access-layer/PLAN.md) | Schema + validators (INN-20…INN-30) | Done on `main` ([#2](https://github.com/QoyyumO/Innov8/pull/2)) |
| [INN-19-synthetic-datasets-from-section-14](features/INN-19-synthetic-datasets-from-section-14/PLAN.md) | §14 seed (INN-31…INN-33) | Done on `main` ([#1](https://github.com/QoyyumO/Innov8/pull/1)) |
| [INN-35-session-helpers-and-append-only-auditlogservice](features/INN-35-session-helpers-and-append-only-auditlogservice/PLAN.md) | Session helpers + append-only audit log | Done on `main` ([#3](https://github.com/QoyyumO/Innov8/pull/3)) |
| [INN-36-patient-discovery-api-and-search-ui](features/INN-36-patient-discovery-api-and-search-ui/PLAN.md) | Patient discovery API + existence-only search UI | Done on `main` ([#6](https://github.com/QoyyumO/Innov8/pull/6)) |
| [INN-47-password-reset-account-takeover](features/INN-47-password-reset-account-takeover/PLAN.md) | Password reset takeover + session status | Done on `main` ([#4](https://github.com/QoyyumO/Innov8/pull/4)) |
| [INN-48-broken-build-npm-ci](features/INN-48-broken-build-npm-ci/PLAN.md) | Clean-checkout `npm ci` + typegen | Done on `main` ([#5](https://github.com/QoyyumO/Innov8/pull/5)) |
| [INN-49-sync-docs-and-add-inn-35-tests](features/INN-49-sync-docs-and-add-inn-35-tests/PLAN.md) | Docs sync + INN-35 tests | Done on `main` ([#7](https://github.com/QoyyumO/Innov8/pull/7)) |
| [INN-38-risk-scoring-service](features/INN-38-risk-scoring-service/PLAN.md) | Risk scoring service (ALLOW ~8 / harvest BLOCK ~94) | Done on `main` ([#8](https://github.com/QoyyumO/Innov8/pull/8)) |
| [INN-37-access-request-api-and-ui](features/INN-37-access-request-api-and-ui/PLAN.md) | Purpose-based access request API + `/requests` UI | Done on `main` ([#9](https://github.com/QoyyumO/Innov8/pull/9)) |
| [INN-40-authorised-clinical-summary](features/INN-40-authorised-clinical-summary/PLAN.md) | Authorised clinical summary after ALLOW | Done on `main` ([#10](https://github.com/QoyyumO/Innov8/pull/10)) |
| [INN-39-harvest-block-security-alerts](features/INN-39-harvest-block-security-alerts/PLAN.md) | Harvest BLOCK, security alerts API, `/security` UI | Done on `main` ([#11](https://github.com/QoyyumO/Innov8/pull/11)) |
| [INN-41-break-glass-emergency-access](features/INN-41-break-glass-emergency-access/PLAN.md) | Break-glass emergency access (15-minute grant, alert, expiry, revoke) | Done on `main` ([#12](https://github.com/QoyyumO/Innov8/pull/12)) |
| [INN-42-audit-trail](features/INN-42-audit-trail/PLAN.md) | Read-only audit trail query + `/audit` UI | Done on `main` ([#13](https://github.com/QoyyumO/Innov8/pull/13)) |
| [INN-43-live-dashboards](features/INN-43-live-dashboards/PLAN.md) | Live role dashboards + `/facilities` | Done on `main` ([#14](https://github.com/QoyyumO/Innov8/pull/14)) |
| [INN-51-expire-allow-decisions](features/INN-51-expire-allow-decisions/PLAN.md) | ALLOW decisions expire after 24 hours (`AccessExpired` audit) | Done on `main` ([#15](https://github.com/QoyyumO/Innov8/pull/15)) |
| [INN-44-verify-step-up](features/INN-44-verify-step-up/PLAN.md) | VERIFY step-up: password re-entry, block after 3 failures | Done on `main` ([#16](https://github.com/QoyyumO/Innov8/pull/16)) |
| [INN-50-audit-alert-actions](features/INN-50-audit-alert-actions/PLAN.md) | Audit alert acknowledge / close | Done on `main` ([#17](https://github.com/QoyyumO/Innov8/pull/17)) |
| [INN-54-fix-leftover-qa-issues](features/INN-54-fix-leftover-qa-issues/PLAN.md) | Login errors, seed recordCount, mobile overlay | Done on `main` ([#18](https://github.com/QoyyumO/Innov8/pull/18)) |
| [INN-55-shrink-seed-for-free-plan](features/INN-55-shrink-seed-for-free-plan/PLAN.md) | Demo-scale seed (24 workers / 200 patients / 200 events) + wipe | Done on `main` ([#22](https://github.com/QoyyumO/Innov8/pull/22)) |
| [INN-52-facility-scoped-admin-views](features/INN-52-facility-scoped-admin-views/PLAN.md) | Hospital admins see only their facility's activity | In review ([#19](https://github.com/QoyyumO/Innov8/pull/19)) |
| [INN-53-facility-stat-counters](features/INN-53-facility-stat-counters/PLAN.md) | Stored per-facility worker / patient totals | In review ([#20](https://github.com/QoyyumO/Innov8/pull/20)) |
| [INN-45-consent-service](features/INN-45-consent-service/PLAN.md) | Patient consent for cross-facility requests | In review ([#21](https://github.com/QoyyumO/Innov8/pull/21)) |
| [INN-46-patient-portal-access-history](features/INN-46-patient-portal-access-history/PLAN.md) | Patient portal: own identity + access history | In review ([#23](https://github.com/QoyyumO/Innov8/pull/23)) |
| [INN-56-audit-patient-searches-no-results](features/INN-56-audit-patient-searches-no-results/PLAN.md) | Audit patient searches with zero results | In progress |

How to run the app and seed: root [`README.md`](../README.md). Seed details: [`convex/README-seeding.md`](../convex/README-seeding.md). Domain map: [`Innov8_DDD.md`](../Innov8_DDD.md).

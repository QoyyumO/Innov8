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
| [INN-42-audit-trail](features/INN-42-audit-trail/PLAN.md) | Read-only audit trail query + `/audit` UI | In review |
| [INN-43-live-dashboards](features/INN-43-live-dashboards/PLAN.md) | Live role dashboards + `/facilities` | In review |

How to run the app and seed: root [`README.md`](../README.md). Seed details: [`convex/README-seeding.md`](../convex/README-seeding.md). Domain map: [`Innov8_DDD.md`](../Innov8_DDD.md).

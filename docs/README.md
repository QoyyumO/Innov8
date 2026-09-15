# Feature plans

Implementation plans for Linear Innov8 tickets (`INN-XX`). Each folder is `docs/features/<TICKET>-<slug>/PLAN.md`.

| Folder | Ticket | Status |
| --- | --- | --- |
| [INN-18-convex-schema-access-layer](features/INN-18-convex-schema-access-layer/PLAN.md) | Schema + validators (INN-20…INN-30) | Done on `main` |
| [INN-19-synthetic-datasets-from-section-14](features/INN-19-synthetic-datasets-from-section-14/PLAN.md) | §14 seed (INN-31…INN-33) | Implemented; PR [#1](https://github.com/QoyyumO/Innov8/pull/1) (`henry`) |
| [INN-47-password-reset-account-takeover](features/INN-47-password-reset-account-takeover/PLAN.md) | Password reset takeover + session status | Done on `main` ([#4](https://github.com/QoyyumO/Innov8/pull/4)) |
| [INN-48-broken-build-npm-ci](features/INN-48-broken-build-npm-ci/PLAN.md) | Clean-checkout `npm ci` + typegen | In progress |
| [INN-35-session-helpers-and-append-only-auditlogservice](features/INN-35-session-helpers-and-append-only-auditlogservice/PLAN.md) | Session helpers + append-only audit log | In review |
| [INN-36-patient-discovery-api-and-search-ui](features/INN-36-patient-discovery-api-and-search-ui/PLAN.md) | Patient discovery API + existence-only search UI | In progress |

How to run the app and seed: root [`README.md`](../README.md). Seed details: [`convex/README-seeding.md`](../convex/README-seeding.md). Domain map: [`Innov8_DDD.md`](../Innov8_DDD.md).

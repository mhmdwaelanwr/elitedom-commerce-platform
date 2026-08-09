# Elitedom Commerce Platform

Elitedom is an enterprise-grade commerce platform for Egyptian technology retail, combining a bilingual customer storefront, staff administration, payments, fulfillment, ERP synchronization, security controls, observability, and governed release operations in one production-oriented monorepo.

> **Release posture:** code quality and launch-control automation are implemented, but public production launch still requires environment-specific credentials, provider acceptance, deployment evidence, backup/restore proof, monitoring validation, and UAT approval for the exact release candidate.

## Repository map

```text
.
├── .github/             CI, ownership, dependency automation, issue/PR intake
├── docs/                Enterprise engineering knowledge base
├── elitedom-store/      Canonical executable commerce platform
├── .editorconfig        Cross-editor formatting defaults
├── .gitattributes       Cross-platform text/binary normalization
├── .gitignore           Repository-wide generated/secret-file policy
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE              Apache License 2.0 for original Elitedom work unless noted
├── NOTICE               Multi-license, attribution, and trademark boundary
├── SECURITY.md
└── README.md
```

The repository intentionally keeps the executable platform under `elitedom-store/` as a stable runtime boundary. Product, architecture, engineering, operations, governance, and release knowledge lives under `docs/`.

## Runtime architecture

| Capability | Implementation |
| --- | --- |
| Storefront and admin | React 19.2, TypeScript 5, Vite 7, React Router 7, Tailwind CSS 4; static production assets served by unprivileged Nginx |
| Application API | Python 3.11, FastAPI, SQLAlchemy async, Pydantic |
| Data | PostgreSQL 15 with Alembic migrations |
| ERP | Odoo 17 Community + `elitedom_connector` |
| Async work | Redis 7 + Celery worker/beat |
| Payments | Paymob primary integration; legacy Stripe compatibility remains isolated |
| Authentication | Password, phone OTP, Google/Apple flows, session management, staff TOTP MFA |
| Media | Local development storage or S3-compatible object storage + CDN |
| Operations | Docker Compose, health/readiness, metrics, tracing hooks, launch control plane |

## Product capabilities

- Bilingual English/Arabic storefront with LTR/RTL and light/dark/system appearance support.
- Product discovery, catalog, cart, checkout, account, B2B, and staff administration journeys.
- Paymob-first payment orchestration with idempotent webhook handling and isolated legacy Stripe compatibility.
- Phone OTP plus Google/Apple identity paths, persisted sessions, staff TOTP MFA, RBAC, and audit controls.
- PostgreSQL-backed transactional state with reversible Alembic migrations and migration replay gates.
- Odoo 17 Community synchronization for catalog, inventory, order, and fulfillment workflows.
- Redis/Celery background processing, transactional/outbox patterns, health/readiness, metrics, and tracing hooks.
- S3-compatible media/CDN support, SEO assets, release acceptance gates, external smoke testing, and operational runbooks.

## Component entry points

- [`elitedom-store/README.md`](elitedom-store/README.md) — executable platform overview and setup entry point.
- [`elitedom-store/backend/README.md`](elitedom-store/backend/README.md) — API/domain/migration boundary.
- [`elitedom-store/frontend/README.md`](elitedom-store/frontend/README.md) — storefront/admin frontend boundary.
- [`elitedom-store/odoo/README.md`](elitedom-store/odoo/README.md) — Odoo connector boundary.
- [`elitedom-store/infrastructure/README.md`](elitedom-store/infrastructure/README.md) — Compose/deployment topology.
- [`elitedom-store/scripts/README.md`](elitedom-store/scripts/README.md) — CI, hygiene, launch, and validation tooling.

## Documentation

Start at [`docs/README.md`](docs/README.md). The documentation corpus distinguishes **current operational truth** from **historical release records** and **superseded architectural decisions**. Current documents identify their authoritative code or configuration sources.

Key entry points:

- [`docs/architecture/README.md`](docs/architecture/README.md) — system boundaries, API, data, ADRs, integrations.
- [`docs/engineering/README.md`](docs/engineering/README.md) — development, testing, design, workflows.
- [`docs/operations/README.md`](docs/operations/README.md) — deployment, runbooks, observability, recovery, compliance readiness.
- [`docs/delivery/README.md`](docs/delivery/README.md) — roadmap, risks, release records.
- [`docs/governance/README.md`](docs/governance/README.md) — documentation ownership, status model, and source-of-truth rules.
- [`elitedom-store/docs/GO_LIVE_RUNBOOK.md`](elitedom-store/docs/GO_LIVE_RUNBOOK.md) — executable go-live procedure.

## Local development

```bash
git clone https://github.com/mhmdwaelanwr/elitedom-erp-architecture-main.git
cd elitedom-erp-architecture-main/elitedom-store
cp .env.example .env
make verify-repo
make dev
make migrate
make seed
```

Local defaults expose the React/Vite storefront on `http://localhost:3000`, FastAPI on `http://localhost:8000`, and Odoo on `http://localhost:8069`.

## Quality gates

Every change must preserve the repository's green baseline:

1. Backend Ruff and pytest.
2. Frontend ESLint, TypeScript, design-system checks, and Vite production build.
3. PostgreSQL fresh upgrade, latest downgrade/replay, and full downgrade/replay.
4. Odoo 17 clean addon install and native tests.
5. Development and production Docker Compose validation.
6. Launch acceptance asset validation.
7. Repository and documentation hygiene validation.

`make verify-repo` runs the repository/documentation/launch/Odoo static contracts locally. GitHub Actions remains authoritative for the complete CI gate set.

## Repository governance

- `CODEOWNERS` defines review ownership and is intended to split by domain as the team grows.
- Dependabot tracks npm, Python/pip, and GitHub Actions dependencies on a controlled weekly cadence.
- Structured issue forms collect reproducible defects and outcome-oriented feature requests without encouraging secrets in public issues.
- `.gitattributes`, `.gitignore`, and Repository Hygiene keep platform-generated/editor/runtime artifacts out of source control.
- Automated dependency PRs are reviewed as production changes; major upgrades are never assumed safe solely because Dependabot generated them.

## Security and secrets

Never commit real credentials, webhook secrets, OAuth secrets, database passwords, recovery codes, or production environment files. Staging and production configuration fails closed for weak core secrets, unsafe hosts/CORS, disabled staff MFA, in-memory rate limiting, and invalid enabled integrations.

Public `VITE_*` frontend values are compiled into the browser bundle and therefore must never contain provider secrets.

See [`SECURITY.md`](SECURITY.md) and [`docs/operations/infrastructure/SECRETS.md`](docs/operations/infrastructure/SECRETS.md).

## Licensing

Original Elitedom source code, documentation, configuration, and repository tooling are licensed under the **Apache License 2.0** unless a file or component explicitly states otherwise. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

The Odoo connector under `elitedom-store/odoo/addons/elitedom_connector/` remains separately licensed under **LGPL-3.0**, matching its addon manifest and the Odoo Community licensing boundary. Third-party frameworks, libraries, container images, media, fonts, and other dependencies retain their respective upstream licenses and notices.

The Apache License 2.0 does not grant rights to Elitedom trademarks, logos, names, or brand identity beyond reasonable attribution.

## Contribution model

Work on focused branches, keep migrations reversible, preserve webhook idempotency/signature verification, and include documentation with behavioral changes. Unless explicitly stated otherwise for a separately licensed component, contributions intentionally submitted for inclusion in the Apache-licensed work are accepted under Apache License 2.0 terms. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

Documentation truth, canonical repository paths, licensing boundaries, and launch-control assets are continuously validated in CI. Production readiness remains release- and environment-specific.

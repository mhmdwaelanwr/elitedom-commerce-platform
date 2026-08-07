# Elitedom Commerce Platform

Elitedom is a production-oriented commerce platform for Egyptian technology retail. The repository contains the customer storefront, staff administration experience, FastAPI application service, PostgreSQL persistence, Redis/Celery background processing, an Odoo 17 connector, deployment topology, and a governed engineering documentation system.

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
├── SECURITY.md
└── README.md
```

The repository intentionally keeps the executable platform under `elitedom-store/` as a stable runtime boundary. Product, architecture, engineering, operations, governance, and release knowledge lives under `docs/`.

## Runtime architecture

| Capability | Implementation |
| --- | --- |
| Storefront and admin | Next.js 16.2, React 19.2, TypeScript, Tailwind CSS 4 |
| Application API | Python 3.11, FastAPI, SQLAlchemy async, Pydantic |
| Data | PostgreSQL 15 with Alembic migrations |
| ERP | Odoo 17 Community + `elitedom_connector` |
| Async work | Redis 7 + Celery worker/beat |
| Payments | Paymob primary integration; legacy Stripe compatibility remains isolated |
| Authentication | Password, phone OTP, Google/Apple flows, session management, staff TOTP MFA |
| Media | Local development storage or S3-compatible object storage + CDN |
| Operations | Docker Compose, health/readiness, metrics, tracing hooks, launch control plane |

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

Local defaults expose the storefront on `http://localhost:3000`, FastAPI on `http://localhost:8000`, and Odoo on `http://localhost:8069`.

## Quality gates

Every change must preserve the repository's green baseline:

1. Backend Ruff and pytest.
2. Frontend ESLint, TypeScript, design-system checks, and production build.
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

## Security and secrets

Never commit real credentials, webhook secrets, OAuth secrets, database passwords, recovery codes, or production environment files. Staging and production configuration fails closed for weak core secrets, unsafe hosts/CORS, disabled staff MFA, in-memory rate limiting, and invalid enabled integrations.

See [`SECURITY.md`](SECURITY.md) and [`docs/operations/infrastructure/SECRETS.md`](docs/operations/infrastructure/SECRETS.md).

## Contribution model

Work on focused branches, keep migrations reversible, preserve webhook idempotency/signature verification, and include documentation with behavioral changes. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

Documentation truth, canonical repository paths, and launch-control assets are continuously validated in CI. Production readiness remains release- and environment-specific.

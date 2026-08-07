# Elitedom Commerce Platform

Elitedom is a production-oriented commerce platform for Egyptian technology retail, combining a bilingual Next.js storefront and admin console, a FastAPI application layer, PostgreSQL, Redis/Celery, Odoo 17 and provider integrations behind explicit operational controls.

> **Release status:** the Stage 0–10 engineering roadmap is implemented and merged. The repository is a green release candidate, not a claim that a production environment has been launched. Real go-live still requires environment secrets, public DNS/TLS, provider acceptance, external smoke evidence and release-scoped UAT sign-off.

## Repository architecture

The repository intentionally has a small root surface:

```text
.
├── .github/             GitHub Actions and repository policy
├── docs/                Product, architecture, engineering, operations and delivery knowledge
├── elitedom-store/      Canonical executable commerce platform
├── .editorconfig        Cross-language editor defaults
├── .gitignore           Repository-wide generated/secret-file policy
├── CONTRIBUTING.md      Engineering and contribution rules
└── README.md            Repository entry point
```

The executable platform remains under `elitedom-store/` to preserve stable CI, Docker, deployment and developer-tooling boundaries:

```text
elitedom-store/
├── backend/             FastAPI, SQLAlchemy, Alembic, Celery and backend tests
├── frontend/            Next.js storefront and administration UI
├── infrastructure/      Development/production Docker Compose and deployment assets
├── odoo/                Odoo 17 addons
├── scripts/             Hygiene, smoke, integration and release validation tools
├── docs/                Implementation-coupled runbooks and status reports
├── .env.example         Environment contract without secrets
├── Makefile             Developer and operator shortcuts
└── README.md            Platform-local guide
```

Architecture and governance documentation is no longer stored as numbered root folders. Start at [`docs/README.md`](docs/README.md).

## Runtime stack

| Area | Technology |
| --- | --- |
| Storefront and admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Application API | Python 3.11, FastAPI, Pydantic, SQLAlchemy async |
| Application data | PostgreSQL 15 with Alembic migrations |
| ERP | Odoo 17 Community with `elitedom_connector` |
| Background processing | Celery and Redis |
| Payments | Paymob integration with signed/idempotent callback handling |
| Authentication | Phone OTP, Google, Apple, tracked sessions and staff MFA controls |
| Deployment | Docker Compose development and production overlays |
| Media | Validated local development storage plus S3-compatible/CDN production support |

## Local development

```bash
git clone https://github.com/mhmdwaelanwr/elitedom-erp-architecture-main.git
cd elitedom-erp-architecture-main/elitedom-store
cp .env.example .env
python3 scripts/check_repository_hygiene.py
make dev
make migrate
make seed
make admin-bootstrap
```

Main local services:

- Storefront: `http://localhost:3000`
- FastAPI docs: `http://localhost:8000/docs`
- API liveness: `http://localhost:8000/health/live`
- API readiness: `http://localhost:8000/health/ready`
- Odoo: `http://localhost:8069`

## Quality gates

Pull requests are expected to preserve the complete CI baseline:

1. Backend — Ruff and full pytest suite on Python 3.11.
2. Frontend — ESLint, TypeScript and production build on Node 22.
3. Odoo 17 — addon structure, clean installation and module tests.
4. PostgreSQL — fresh upgrade, latest downgrade/replay and full downgrade/replay.
5. Docker Compose — development and production topology validation.
6. Launch acceptance — release-control assets and go-live guardrails.

A separate Repository Hygiene workflow enforces canonical paths and rejects generated files, secrets, retired sources and root-structure drift.

## Documentation map

- [`docs/product/`](docs/product/) — foundation and requirements.
- [`docs/architecture/`](docs/architecture/) — solution design, ADRs, C4, data, APIs and integrations.
- [`docs/engineering/`](docs/engineering/) — workflows, UI/UX, testing and development standards.
- [`docs/operations/`](docs/operations/) — infrastructure, runbooks, observability, governance, DR and compliance.
- [`docs/delivery/`](docs/delivery/) — project-management material and stage release history.
- [`elitedom-store/docs/`](elitedom-store/docs/) — implementation-coupled runbooks and current operational status.

## Production release control

The admin Launch Control Plane records automatic readiness gates and operator evidence by **release reference + environment + gate**. Evidence from an older release cannot satisfy a newer release.

Actual production launch requires the target environment to pass its external smoke run and required operator gates, including provider flows, bilingual UAT, backup/restore, monitoring and rollback evidence.

## Security

Never commit third-party secrets, customer data, `.env` files, access tokens or production credentials. Deployment secrets are supplied through environment/secret-management tooling and production configuration fails closed when mandatory security controls are missing.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository conventions and validation expectations.

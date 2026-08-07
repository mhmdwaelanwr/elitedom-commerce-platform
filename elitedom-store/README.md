# Elitedom Store Platform

`elitedom-store/` is the canonical executable boundary of the repository. It contains the storefront, API, ERP connector, deployment topology and the tooling required to validate them together.

## Components

```text
elitedom-store/
├── backend/             FastAPI application, workers, migrations and tests
├── frontend/            Next.js storefront and admin console
├── infrastructure/      Docker Compose development/production topology
├── odoo/                Odoo 17 addons
├── scripts/             Repository, integration, smoke and launch validators
├── docs/                Implementation-coupled runbooks and status reports
├── .env.example         Environment-variable contract
└── Makefile             Development and operational shortcuts
```

## Stack

- Python 3.11, FastAPI, Pydantic and async SQLAlchemy
- PostgreSQL 15 and Alembic
- Next.js 16, React 19, TypeScript and Tailwind CSS 4
- Odoo 17 Community
- Redis and Celery
- Paymob payments
- Phone OTP plus Google/Apple authentication
- Staff MFA and backend-enforced RBAC/audit controls
- Docker Compose development and production overlays
- S3-compatible media storage/CDN support with local development fallback

## Quick start

For the complete environment-variable reference, see [`SETUP_AND_ENV_GUIDE.md`](SETUP_AND_ENV_GUIDE.md).

```bash
cp .env.example .env
python3 scripts/check_repository_hygiene.py
make dev
make migrate
make seed
make admin-bootstrap
```

Local endpoints:

- Storefront: `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Liveness: `http://localhost:8000/health/live`
- Readiness: `http://localhost:8000/health/ready`
- Odoo: `http://localhost:8069`
- Admin: `http://localhost:3000/admin`

## Developer commands

```bash
make help
make dev
make stop
make test
make lint
make migrate
make seed
make admin-bootstrap
make validate-odoo
```

`make clean` removes Docker volumes and local data. Use it only for an intentional destructive reset.

## Architecture rules

- The backend is a modular monolith: domain behavior belongs in its owning module; shared code is reserved for genuinely cross-cutting contracts.
- PostgreSQL schema changes go through Alembic and must support fresh upgrade, latest downgrade/replay and full downgrade/replay.
- External callbacks are signature/HMAC verified, idempotent and fail closed.
- Staff authorization is evaluated against persisted backend state; privileged sessions are subject to MFA policy.
- The frontend preserves English/Arabic, RTL/LTR, responsive behavior and light/dark/system preferences.
- Production secrets are deployment-managed and never stored in source control.

## Validation

```bash
python3 scripts/check_repository_hygiene.py
python3 scripts/validate_launch_assets.py

cd backend
python -m ruff check .
python -m pytest app/tests -q

cd ../frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions additionally performs native Odoo 17 installation/tests, PostgreSQL migration replay, Docker Compose validation and the launch-acceptance gate.

## Documentation

- Repository knowledge base: [`../docs/README.md`](../docs/README.md)
- Implementation status: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)
- Go-live runbook: [`docs/GO_LIVE_RUNBOOK.md`](docs/GO_LIVE_RUNBOOK.md)
- Go-live checklist: [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md)
- Odoo connector runbook: [`docs/ODOO_CONNECTOR_RUNBOOK.md`](docs/ODOO_CONNECTOR_RUNBOOK.md)

Merging code is not the same as a live production release. Use the release-scoped Launch Control Plane and external smoke workflow for target-environment acceptance.

# Elitedom Store Runtime

`elitedom-store/` is the canonical executable commerce platform in this repository.

## Components

```text
elitedom-store/
├── backend/          FastAPI application, workers, SQLAlchemy/Alembic and tests
├── frontend/         Next.js storefront and administration application
├── infrastructure/   Docker Compose topology and operational scripts
├── odoo/             Odoo 17 addons
├── scripts/          Validation, smoke and repository tooling
├── docs/             Runtime-adjacent runbooks and implementation status
├── .env.example      Configuration contract with placeholders only
└── Makefile          Developer/operator shortcuts
```

Component entry points:

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`infrastructure/README.md`](infrastructure/README.md)
- [`odoo/README.md`](odoo/README.md)
- [`scripts/README.md`](scripts/README.md)

## Local bootstrap

```bash
cp .env.example .env
make verify-repo
make dev
make migrate
make seed
```

Use `make admin-bootstrap` to create a development administrator interactively. There is no default production administrator password.

## Current runtime

- Next.js 16.2 / React 19.2 / TypeScript / Tailwind 4 storefront and admin.
- FastAPI on Python 3.11 with PostgreSQL 15 application persistence.
- Odoo 17 Community with `elitedom_connector` 17.0.2.0.0.
- Redis 7 and Celery worker/beat.
- Paymob primary payment integration; isolated Stripe legacy compatibility.
- Phone OTP, Google/Apple identity paths, persisted sessions and staff TOTP MFA.
- Backend RBAC/audit and launch control plane.
- Local or S3-compatible media with CDN configuration.
- Health/readiness, protected metrics and optional OpenTelemetry export.

## Quality commands

```bash
# repository/documentation/launch/Odoo static contracts
make verify-repo

# backend
cd backend
python -m ruff check .
python -m pytest app/tests -q

# frontend
cd ../frontend
npm ci
npm run verify
npm run build
```

GitHub CI additionally replays migrations against PostgreSQL 15, installs/tests the Odoo addon in a clean Odoo 17 container, validates Compose overlays and validates launch assets.

Use `make clean` when you need to reset local containers/volumes and remove generated Python, test, Next.js, and TypeScript build artifacts.

## Environment safety

`.env.example` is documentation, not a production secret file. In staging/production the backend rejects unsafe configuration including debug mode, wildcard hosts/CORS, disabled staff MFA, in-memory rate limiting, weak core secrets and invalid enabled integrations.

Production Paymob, OAuth, Twilio/email, Odoo, object storage, metrics and other provider values must be provisioned out-of-band and verified for the exact environment.

## Operations

- Liveness: `/health` and `/health/live`
- Readiness: `/health/ready`
- API base: `/api/v1`
- Metrics: `/metrics` when enabled/protected
- Launch runbook: [`docs/GO_LIVE_RUNBOOK.md`](docs/GO_LIVE_RUNBOOK.md)
- Implementation status: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)
- Enterprise knowledge base: [`../docs/README.md`](../docs/README.md)

Passing CI means the repository is deployable/tested; it does not replace live provider acceptance, UAT, backup/restore, monitoring and rollback evidence.

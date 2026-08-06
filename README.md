# Elitedom Commerce Platform

Elitedom is an actively developed commerce platform that combines a customer storefront, a FastAPI application service, PostgreSQL, Redis/Celery, and an Odoo 17 ERP connector.

> **Delivery status:** the repository is suitable for local development and staging work. It is not yet approved for a public production launch. Paymob, phone-first authentication, bilingual RTL/LTR UI, full permission management, shipping operations, legal/commercial configuration, and production UAT remain delivery gates.

## Canonical implementation

All executable application code lives under [`elitedom-store/`](elitedom-store/):

```text
elitedom-store/
├── backend/          FastAPI, SQLAlchemy, Alembic, workers and tests
├── frontend/         Next.js storefront and administration UI
├── infrastructure/   Development and production Docker Compose overlays
├── odoo/             Bundled Odoo 17 addons
├── scripts/          Repository and integration validation tools
└── docs/             Implementation and delivery reports
```

The numbered root directories (`00_PROJECT_FOUNDATION` through `18_COMPLIANCE`) contain architecture and operating documentation. Start with [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md) for that material.

## Runtime stack

| Area | Technology |
| --- | --- |
| Storefront and admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Application API | Python 3.11, FastAPI, Pydantic, SQLAlchemy async |
| Application data | PostgreSQL 15 and Alembic migrations |
| ERP | Odoo 17 Community with `elitedom_connector` |
| Background jobs | Celery and Redis |
| Deployment | Docker Compose development and production overlays |

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

Main local endpoints:

- Storefront: `http://localhost:3000`
- FastAPI documentation: `http://localhost:8000/docs`
- FastAPI health: `http://localhost:8000/health`
- Odoo: `http://localhost:8069`

`make clean` removes Docker volumes and local data. Use it only when an intentional destructive reset is required.

## Quality gates

```bash
cd elitedom-store
python3 scripts/check_repository_hygiene.py
make validate-odoo

cd backend
python -m ruff check .
python -m pytest app/tests -q

cd ../frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

GitHub Actions additionally installs and tests the addon in the official Odoo 17 image, replays Alembic migrations against PostgreSQL 15, validates both Docker Compose topologies, and runs repository hygiene independently.

## Integration status

- **Odoo:** bundled addon, signed webhooks, idempotent processing, outbox/retry, catalogue, inventory, order and shipment events are implemented.
- **Product media:** local filesystem storage is available for development; production object storage/CDN remains required.
- **Payments:** Stripe-era code remains during the transition. Paymob is not implemented yet and will be introduced behind a provider-neutral payment service.
- **Authentication:** email/password and backend social-token verification exist. Phone OTP, complete Google/Apple browser flows, account linking and hardened session revocation remain planned.
- **Notifications and optional providers:** incomplete providers are fail-closed and disabled unless valid configuration is supplied.

No third-party secret belongs in source control. Copy `.env.example` locally and provide real credentials only through environment or secret-management tooling.

## Delivery reports

- [`elitedom-store/docs/STAGE_0_BASELINE.md`](elitedom-store/docs/STAGE_0_BASELINE.md) — verified implementation baseline and launch gaps.
- [`elitedom-store/docs/STAGE_1_CLEANUP_REPORT.md`](elitedom-store/docs/STAGE_1_CLEANUP_REPORT.md) — repository cleanup evidence and retained/deferred work.

Future feature work must preserve migration compatibility, backend authorization checks, current Odoo contracts, and a green CI baseline.
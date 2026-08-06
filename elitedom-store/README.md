# Elitedom Store

**Enterprise-grade e-commerce platform for Egyptian technology retail.**

Powered by **FastAPI** + **Odoo 17 Community Edition** + **PostgreSQL 15**, deployed on **Oracle Cloud VPS** via **Docker**.

---

## Architecture

- **Backend**: Python 3.11+ / FastAPI (async)
- **ERP**: Odoo 17 Community Edition
- **Database**: PostgreSQL 15
- **Frontend**: Next.js 16 (App Router, Tailwind 4)
- **Queue**: Redis 7 + Celery
- **Infrastructure**: Docker Compose, Nginx Proxy Manager
- **Integrations**: Stripe, Algolia, Twilio, SendGrid, Zeptomail, Zoho, Hedera

## Quick Start

> [!IMPORTANT]  
> **For full step-by-step setup instructions and links on where to get every API key and environment variable, read the [Setup & Environment Variables Guide](./SETUP_AND_ENV_GUIDE.md).**

```bash
# 1. Copy environment variables
cp .env.example .env
# For a local demo, begin with the template values. Before staging or
# production, replace every template credential with generated values
# (see SETUP_AND_ENV_GUIDE.md).

# 2. Start all services
make dev

# 3. Run database migrations
make migrate

# 4. Load a safe local catalog, images, and verified demo supplier mappings
make seed

# 5. Create your own development-only administrator (interactive; no default password)
make admin-bootstrap

# 6. Access services
# FastAPI API:      http://localhost:8000
# Swagger Docs:     http://localhost:8000/docs
# Odoo ERP:         http://localhost:8069
# Next.js Frontend: http://localhost:3000 (started by make dev)
# Admin Console:    http://localhost:3000/admin
```

## Project Structure

```
elitedom-store/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py       # Application entry point
│   │   ├── config.py     # Settings (pydantic-settings)
│   │   ├── database.py   # SQLAlchemy async engine
│   │   ├── models.py     # All ORM models
│   │   ├── modules/      # Domain modules (auth, products, orders, ...)
│   │   ├── integrations/ # Third-party clients (Odoo, Stripe, Twilio, ...)
│   │   ├── shared/       # Shared schemas, events, exceptions, security
│   │   └── middleware/    # Rate limiting, webhook validation
│   ├── alembic/          # Database migrations
│   └── requirements.txt
├── frontend/             # Next.js storefront
├── infrastructure/       # Docker Compose & deployment
└── Makefile              # Developer shortcuts
```

## API Endpoints

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/api/v1/auth` | Register, login, OAuth, JWT refresh |
| Products | `/api/v1/products` | Catalog, search, categories |
| Orders | `/api/v1/orders` | Cart, checkout, order management |
| Customers | `/api/v1/customers` | Profile, addresses, wishlist |
| Inventory | `/api/v1/inventory` | Stock levels, serial tracking |
| Payments | `/api/v1/payments` | Payment status, refunds |
| Shipping | `/api/v1/shipping` | Tracking, dispatch, shipping rates |
| Warranty | `/api/v1/warranty` | RMA claims, warranty check |
| Suppliers | `/api/v1/suppliers` | Supplier management, POs |
| Loyalty | `/api/v1/loyalty` | Points balance, redemption |
| B2B | `/api/v1/b2b` | RFQ, quotes, institutional sales |
| Reports | `/api/v1/reports` | Dashboard, analytics |

## Storefront behaviour

- The imported ecommerce template is incorporated as curated visual assets under `frontend/public/template/images`; Elitedom keeps its existing Next.js 16/Tailwind 4 architecture and FastAPI integration layer.
- `make seed` is idempotent and adds a development-only verified demo supplier plus product-supplier mappings, so the example catalog follows the same publication and dropship rules as production records.
- Cart persistence supports both anonymous browser sessions and signed-in customers. Anonymous carts merge safely after sign-in.
- Credit-card checkout requires real `STRIPE_*` credentials and configured `STRIPE_CHECKOUT_SUCCESS_URL` / `STRIPE_CHECKOUT_CANCEL_URL`; otherwise use Cash on Delivery during local setup.
- Odoo inbound webhooks fail closed until `ODOO_WEBHOOK_SECRET` is a generated non-template secret. Staging and production also reject placeholder JWT, database, Redis, and Odoo secrets at startup.
- Run `make migrate` after updating the source to apply customer portal, payment, transactional-outbox, and hybrid-dropship migrations.

## Production storefront

The Next.js storefront is built as a minimal, non-root standalone Docker image. Before building it, set `NEXT_PUBLIC_API_URL` in `.env` to the **browser-reachable HTTPS** API URL (for example, `https://api.store.example.com/api/v1`) and add the storefront origin to `CORS_ORIGINS`.

```bash
cd infrastructure
docker compose --env-file ../.env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build frontend
```

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so changing it requires an image rebuild. The production overlay fails early if it is missing. The Compose port is bound to host loopback; point Nginx Proxy Manager at `frontend:3000` on `elitedom-net` for the public domain and TLS termination.

## Developer Commands

```bash
make help           # Show all available commands
make dev            # Start development environment
make stop           # Stop all services
make test           # Run tests with coverage
make lint           # Run linter
make migrate        # Run database migrations
make seed           # Create/refresh local demo catalogue only
make admin-bootstrap # Create a local system administrator interactively
make db-shell       # Open Odoo PostgreSQL shell
make app-db-shell   # Open Store API PostgreSQL shell
```

## Operations

- `GET /metrics` exposes Prometheus RED metrics and is intended for an internal scraper only.
- API responses include `X-Request-ID`; production logs are JSON with common secrets and email values masked.
- `infrastructure/scripts/backup.sh` backs up both the Odoo and Store API databases. `restore.sh <file> <app|odoo>` requires an explicit target database name before it writes anything.

## Documentation

Architecture documentation is maintained in the companion repository:
[elitedom-erp-architecture](../README.md)

For the implementation-to-document mapping and the remaining operator-provisioned credentials, see [Implementation Status](./docs/IMPLEMENTATION_STATUS.md).

---

**Elitedom Store** © 2026 — All rights reserved.

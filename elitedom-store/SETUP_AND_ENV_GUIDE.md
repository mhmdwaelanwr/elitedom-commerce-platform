# Elitedom Store ERP — Setup & Environment Variables Guide

This document is the authoritative guide for setting up, running, and configuring the **Elitedom Store ERP** full-stack enterprise e-commerce platform. It explains how to launch all services locally or in production and provides direct links and instructions for obtaining every required environment variable.

---

## Table of Contents

1. [Architecture & System Prerequisites](#1-architecture--system-prerequisites)
2. [Quick-Start Development Setup](#2-quick-start-development-setup)
3. [Environment Variables Reference & How to Obtain Them](#3-environment-variables-reference--how-to-obtain-them)
   - [General & Application Secrets](#31-general--application-secrets)
   - [PostgreSQL & Redis](#32-postgresql--redis)
   - [Odoo 17 CE ERP](#33-odoo-17-ce-erp)
   - [Stripe Payment Gateway](#34-stripe-payment-gateway)
   - [Algolia Search](#35-algolia-search)
   - [Twilio SMS Notifications](#36-twilio-sms-notifications)
   - [SendGrid Email](#37-sendgrid-email)
   - [Zeptomail Transactional Email](#38-zeptomail-transactional-email)
   - [Zoho CRM Integration](#39-zoho-crm-integration)
   - [Hedera Blockchain Audit](#310-hedera-blockchain-audit)
   - [Docker Ports & Local Service Overrides](#311-docker-ports--local-service-overrides)
4. [Production Deployment (VPS / Oracle Cloud)](#4-production-deployment-vps--oracle-cloud)
5. [Useful Developer Commands](#5-useful-developer-commands)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Architecture & System Prerequisites

### Core Codebase Files

- **Docker Compose Definitions:** [docker-compose.yml](./infrastructure/docker-compose.yml) & [docker-compose.dev.yml](./infrastructure/docker-compose.dev.yml)
- **Environment Template:** [.env.example](./.env.example)
- **Developer Makefile:** [Makefile](./Makefile)
- **FastAPI Backend Entrypoint:** [main.py](./backend/app/main.py)
- **Next.js Storefront Root:** [frontend/](./frontend)

### Prerequisites

Before starting, ensure you have the following installed on your machine or VPS:

1. **Docker & Docker Compose (v2.20+):** Required to run Odoo 17 CE, PostgreSQL 15, Redis 7, and Nginx Proxy Manager.
   - _Download:_ [Docker Desktop](https://www.docker.com/products/docker-desktop/) or install via package manager on Linux.
2. **Node.js (v20.0+ / v22 LTS) & npm:** Required for the Next.js 14/16 App Router storefront.
   - _Download:_ [Node.js Official Downloads](https://nodejs.org/)
3. **Python (v3.11+):** Required if running FastAPI outside Docker or running migrations via Alembic locally.
   - _Download:_ [Python Official Site](https://www.python.org/downloads/)

---

## 2. Quick-Start Development Setup

Follow these four steps to run the complete stack on your local machine:

### Step 1: Initialize Environment Variables

Copy the template file [.env.example](./.env.example) to `.env` in the root of `elitedom-store/`:

```bash
cp .env.example .env
```

For a local demo, the template starts the stack and lets you seed the
catalogue. Before staging or production, replace every template credential
with generated secrets (see Section 3 below). The application rejects unsafe
JWT, database, Redis, and Odoo webhook values outside development.

### Step 2: Start Infrastructure Containers

Use the developer [Makefile](./Makefile) to start the PostgreSQL database, Redis queue, Odoo 17 CE ERP, FastAPI application, and Next.js storefront containers:

```bash
make dev
```

_Expected Output:_

- **FastAPI API & Swagger:** `http://localhost:8000/docs`
- **Next.js Storefront:** `http://localhost:3000`
- **Odoo 17 CE ERP:** `http://localhost:8069`
- **PostgreSQL 15:** `localhost:5432`
- **Redis 7:** `localhost:6379`

### Step 3: Run Database Migrations

Apply the Store API database migrations using Alembic, then load the safe development catalog:

```bash
make migrate
make seed
```

`make seed` is idempotent and is intentionally limited to the `development` environment. It creates example products, local image references, and a verified demo supplier mapping so the catalogue follows the same sourcing rules as production.

### Step 4: Create a Local Admin and Open the Storefront

Create a non-default administrator interactively:

```bash
make admin-bootstrap
```

Open **`http://localhost:3000`** in your browser to view the storefront, or **`http://localhost:3000/admin`** to use the staff dashboard. The bootstrap command only runs in development and asks you to choose the credentials; it never ships a default password.

---

## 3. Environment Variables Reference & How to Obtain Them

Below is the complete breakdown of every environment variable in [.env.example](./.env.example).

### 3.1 General & Application Secrets

| Variable                          | Default / Example                        | How to Obtain / Configure                                                   |
| :-------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------- |
| `ENVIRONMENT`                     | `development`                            | Set to `development`, `staging`, or `production`.                           |
| `DEBUG`                           | `true`                                   | Set to `true` for local debugging; **must be `false` in production**.       |
| `APP_NAME`                        | `Elitedom Store`                         | Display name used by the API and operational logs.                          |
| `APP_VERSION`                     | `1.0.0`                                  | Application version surfaced in the API and startup logs.                   |
| `SECRET_KEY`                      | _(Random string)_                        | Generate using: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET_KEY`                  | _(Random string)_                        | Generate using: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ALGORITHM`                   | `HS256`                                  | Keep default `HS256`.                                                       |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60`                                     | Lifespan of short-lived JWT access tokens.                                  |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS`   | `7`                                      | Lifespan of refresh tokens used for session renewal.                        |
| `ALLOWED_HOSTS`                   | `localhost,127.0.0.1,api.elitedom.store` | Comma-separated list of allowed domains for the API.                        |
| `TRUSTED_PROXY_IPS`                | _(empty)_                                | Comma-separated reverse-proxy IPs allowed to provide `X-Forwarded-For`; leave empty unless fixed and trusted. |

---

### 3.2 PostgreSQL & Redis

| Variable                | Default in Docker          | Description & Setup                                               |
| :---------------------- | :------------------------- | :---------------------------------------------------------------- |
| `POSTGRES_USER`         | `elitedom`                 | PostgreSQL root user.                                             |
| `POSTGRES_PASSWORD`     | `CHANGE_ME`                | Set a strong database password in `.env`.                         |
| `POSTGRES_DB`           | `elitedom_db`              | Name of the primary database.                                     |
| `POSTGRES_HOST`         | `postgres`                 | Docker Compose hostname (`postgres`) or remote DB host.           |
| `POSTGRES_PORT`         | `5432`                     | Standard PostgreSQL port.                                         |
| `DATABASE_URL`          | `postgresql+asyncpg://...` | Assembled automatically for SQLAlchemy async connections.         |
| `REDIS_HOST`            | `redis`                    | Docker Compose hostname (`redis`).                                |
| `REDIS_PORT`            | `6379`                     | Standard Redis port used by the compose stack.                    |
| `REDIS_PASSWORD`        | `elitedom_redis`           | Set a secure Redis authentication password.                       |
| `REDIS_URL`             | `redis://.../0`            | Redis connection URL for application caching and background jobs. |
| `CELERY_BROKER_URL`     | `redis://.../1`            | Redis database `1` for Celery async task queueing.                |
| `CELERY_RESULT_BACKEND` | `redis://.../2`            | Redis database `2` for Celery task results.                       |

---

### 3.3 Odoo 17 CE ERP

Odoo 17 CE is the ERP backbone for inventory and order management per [client.py](./backend/app/integrations/odoo/client.py).

| Variable              | Example                 | How to Obtain                                                                              |
| :-------------------- | :---------------------- | :----------------------------------------------------------------------------------------- |
| `ODOO_URL`            | `http://odoo:8069`      | Internal Docker Compose hostname or public Odoo URL.                                       |
| `ODOO_DB`             | `elitedom_db`           | The database name inside Odoo.                                                             |
| `ODOO_API_USER`       | `elitedom_api_user`     | Dedicated API user created in Odoo (_Settings → Users_).                                   |
| `ODOO_API_KEY`        | `CHANGE_ME`             | In Odoo: Go to **Settings → Users → [User] → Account Security → New API Key**.             |
| `ODOO_WEBHOOK_SECRET` | `CHANGE_ME_HMAC_SECRET` | Generate a 32-byte hex string: `python3 -c "import secrets; print(secrets.token_hex(16))"` |

---

### 3.4 Stripe Payment Gateway

Used for credit card checkout and webhook payment confirmation per [webhooks.py](./backend/app/integrations/stripe/webhooks.py).

- **Official Portal:** [Stripe Dashboard API Keys](https://dashboard.stripe.com/test/apikeys)
- **Webhook Management:** [Stripe Webhooks Console](https://dashboard.stripe.com/test/webhooks)

| Variable                 | Format        | How to Obtain                                                                                                                                                          |
| :----------------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`      | `sk_test_...` | In Stripe Dashboard: **Developers → API keys → Secret key**.                                                                                                           |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | In Stripe Dashboard: **Developers → API keys → Publishable key**.                                                                                                      |
| `STRIPE_WEBHOOK_SECRET`  | `whsec_...`   | In Stripe Dashboard: **Developers → Webhooks → Add endpoint** (`https://yourdomain.com/api/v1/integrations/stripe/stripe-callback`) → click **Reveal signing secret**. |
| `STRIPE_CURRENCY`        | `egp`         | Default currency code for checkout sessions (`egp` or `usd`).                                                                                                          |

---

### 3.5 Algolia Search

Provides sub-50ms search for hardware catalogs and SKU filters.

- **Official Portal:** [Algolia Dashboard API Keys](https://dashboard.algolia.com/account/api-keys/all)

| Variable             | Example             | How to Obtain                                                                            |
| :------------------- | :------------------ | :--------------------------------------------------------------------------------------- |
| `ALGOLIA_APP_ID`     | `X8...`             | In Algolia Dashboard: **Settings → API Keys → Application ID**.                          |
| `ALGOLIA_API_KEY`    | `...`               | In Algolia Dashboard: **Settings → API Keys → Admin API Key** (backend only).            |
| `ALGOLIA_SEARCH_KEY` | `...`               | In Algolia Dashboard: **Settings → API Keys → Search-Only API Key** (safe for frontend). |
| `ALGOLIA_INDEX_NAME` | `elitedom_products` | Create an index named `elitedom_products` in your Algolia application.                   |

---

### 3.6 Twilio SMS Notifications

Sends automated Egyptian mobile SMS alerts when orders ship or are delivered per [twilio/tasks.py](./backend/app/integrations/twilio/tasks.py).

- **Official Portal:** [Twilio Console](https://console.twilio.com/)

| Variable                       | Format              | How to Obtain                                                               |
| :----------------------------- | :------------------ | :-------------------------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID`           | `AC...`             | On your Twilio Console home screen under **Account Info**.                  |
| `TWILIO_AUTH_TOKEN`            | `...`               | On your Twilio Console home screen under **Account Info** → **Auth Token**. |
| `TWILIO_PHONE_NUMBER`          | `+1...` or `+20...` | In Twilio Console: **Phone Numbers → Manage → Active numbers**.             |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG...`             | In Twilio Console: **Messaging → Services → Create Messaging Service**.     |

---

### 3.7 SendGrid Email

Sends PDF invoices, receipts, and order confirmation emails per [sendgrid/tasks.py](./backend/app/integrations/sendgrid/tasks.py).

- **Official Portal:** [SendGrid API Keys Console](https://app.sendgrid.com/settings/api_keys)

| Variable              | Example                  | How to Obtain                                                                                      |
| :-------------------- | :----------------------- | :------------------------------------------------------------------------------------------------- |
| `SENDGRID_API_KEY`    | `SG....`                 | In SendGrid: **Settings → API Keys → Create API Key (Full Access)**.                               |
| `SENDGRID_FROM_EMAIL` | `noreply@elitedom.store` | Must be an authenticated Single Sender or verified Domain in **Settings → Sender Authentication**. |
| `SENDGRID_FROM_NAME`  | `Elitedom Store`         | Display name for outgoing customer receipts.                                                       |

---

### 3.8 Zeptomail Transactional Email

Backup low-latency transactional email gateway for OTPs and RMA warranty notifications per [zeptomail/tasks.py](./backend/app/integrations/zeptomail/tasks.py).

- **Official Portal:** [Zoho Zeptomail Console](https://zeptomail.zoho.com/)

| Variable                   | Example                  | How to Obtain                                                                |
| :------------------------- | :----------------------- | :--------------------------------------------------------------------------- |
| `ZEPTOMAIL_API_KEY`        | `Zoho-enczapikey ...`    | In Zeptomail: Select your **Mail Agent → Setup Info → Send Mail API Token**. |
| `ZEPTOMAIL_FROM_EMAIL`     | `noreply@elitedom.store` | Authenticated domain email in your Zeptomail Mail Agent.                     |
| `ZEPTOMAIL_BOUNCE_ADDRESS` | `bounce@elitedom.store`  | Configured bounce return address in Zeptomail settings.                      |

---

### 3.9 Zoho CRM Integration

Synchronizes Egyptian customer profiles and corporate accounts with Zoho CRM.

- **Official Portal:** [Zoho API Console](https://api-console.zoho.com/)

| Variable             | Example    | How to Obtain                                                                               |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------ |
| `ZOHO_CLIENT_ID`     | `1000....` | In Zoho API Console: Click **Add Client → Server-based Applications** → Copy **Client ID**. |
| `ZOHO_CLIENT_SECRET` | `...`      | In Zoho API Console: Click your app → Copy **Client Secret**.                               |
| `ZOHO_REFRESH_TOKEN` | `1000....` | Generate via Zoho OAuth 2.0 authorization code flow for scope `ZohoCRM.modules.ALL`.        |
| `ZOHO_ORG_ID`        | `...`      | In Zoho CRM: **Settings → Setup → Company Details → Organization ID**.                      |

---

### 3.10 Hedera Blockchain Audit

Hashes payment transactions and warranty tickets onto the Hedera Consensus Service per [hedera/tasks.py](./backend/app/integrations/hedera/tasks.py).

- **Official Portal:** [Hedera Developer Portal](https://portal.hedera.com/register)
- **Testnet Explorer:** [HashScan Testnet](https://hashscan.io/testnet/dashboard)

| Variable              | Format                 | How to Obtain                                                                     |
| :-------------------- | :--------------------- | :-------------------------------------------------------------------------------- |
| `HEDERA_NETWORK`      | `testnet` or `mainnet` | Use `testnet` for staging and `mainnet` for production.                           |
| `HEDERA_OPERATOR_ID`  | `0.0.xxxxx`            | In Hedera Developer Portal: Your **Account ID** (e.g., `0.0.5982144`).            |
| `HEDERA_OPERATOR_KEY` | `302e0201...`          | In Hedera Developer Portal: Your **DER Encoded Private Key**.                     |
| `HEDERA_TOPIC_ID`     | `0.0.xxxxx`            | Create a Hedera Consensus Service (HCS) topic via SDK or Portal and enter its ID. |

---

### 3.11 Docker Ports & Local Service Overrides

These are optional when you want to change the default port mapping used by the compose stack.

| Variable             | Default | Description                                             |
| :------------------- | :------ | :------------------------------------------------------ |
| `FASTAPI_PORT`       | `8000`  | Host port for the FastAPI application.                  |
| `ODOO_PORT`          | `8069`  | Host port for the Odoo web UI.                          |
| `ODOO_LONGPOLL_PORT` | `8072`  | Host port for Odoo long-polling/websocket traffic.      |
| `PORTAINER_PORT`     | `9443`  | Host port for Portainer if you enable it in your stack. |

---

## 4. Production Deployment (VPS / Oracle Cloud)

To deploy **Elitedom Store** on a production Linux VPS (e.g., Oracle Cloud Infrastructure, AWS, or DigitalOcean):

1. **Clone the Repository on your VPS:**
   ```bash
   git clone https://github.com/mhmdwaelanwr/elitedom-erp-architecture.git
   cd elitedom-erp-architecture/elitedom-store
   ```
2. **Configure `.env` for Production:**
   ```bash
   cp .env.example .env
   # Edit .env: Set ENVIRONMENT=production, DEBUG=false, and enter live API keys
   ```
3. **Deploy Docker Containers:**
   ```bash
   cd infrastructure
   docker compose -f docker-compose.yml up -d --build
   ```
4. **Apply Production Database Migrations:**
   ```bash
   docker compose exec fastapi alembic upgrade head
   ```
5. **Configure Nginx Proxy Manager / SSL:**
   - Access Nginx Proxy Manager on port `81` (`http://your-server-ip:81`).
   - Default login: `admin@example.com` / `changeme`.
   - Add Proxy Hosts for `api.elitedom.store` (target `fastapi:8000`) and `odoo.elitedom.store` (target `odoo:8069`) with **Let's Encrypt SSL certificates**.

---

## 5. Useful Developer Commands

All developer shortcuts are defined in [Makefile](./Makefile):

| Command                       | Action                                                            |
| :---------------------------- | :---------------------------------------------------------------- |
| `make dev`                    | Start all infrastructure and backend services in Docker.          |
| `make stop`                   | Stop all running containers.                                      |
| `make migrate`                | Execute all pending Alembic database migrations.                  |
| `make migrate-new MSG="name"` | Autogenerate a new database migration file.                       |
| `make test`                   | Run pytest backend unit and integration test suite with coverage. |
| `make lint`                   | Run ruff code linter on the backend codebase.                     |
| `make db-shell`               | Open an interactive `psql` shell in the PostgreSQL container.     |
| `make redis-cli`              | Open an interactive Redis command line interface.                 |

---

## 6. Troubleshooting

### 1. `EACCES: permission denied` when installing npm packages

- _Cause:_ npm cache permission mismatch in `/Users/$USER/.npm`.
- _Solution:_ Run `npm cache clean --force` or use a temporary cache directory:
  ```bash
  npm_config_cache=/tmp/npm-cache npm install
  ```

### 2. Odoo 17 CE XML-RPC Authentication Fails (`UID is None`)

- _Cause:_ Incorrect `ODOO_DB`, `ODOO_API_USER`, or `ODOO_API_KEY` in `.env`.
- _Solution:_ Ensure you generated an **API Key** inside Odoo (_Settings → Users → Account Security_) instead of using your login password. Check logs using:
  ```bash
  make logs-api
  ```

### 3. Stripe Webhook Signature Verification Fails

- _Cause:_ Using the test secret key instead of the endpoint-specific webhook signing secret (`whsec_...`).
- _Solution:_ Verify the `STRIPE_WEBHOOK_SECRET` matches the signing secret displayed in the Stripe Webhooks console for your exact URL path (`/api/v1/integrations/stripe/stripe-callback`).

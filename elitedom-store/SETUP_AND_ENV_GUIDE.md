# Setup and Environment Guide

This guide explains how to configure Elitedom without committing secrets. The authoritative key names/defaults are `./.env.example` and `backend/app/config.py`.

## 1. Local setup

```bash
cp .env.example .env
make dev
make migrate
make seed
make admin-bootstrap
```

Keep `.env` untracked. Development can leave optional providers disabled.

## 2. Core application settings

Set a generated `SECRET_KEY` and `JWT_SECRET_KEY`; they must be different in staging/production. Configure allowed hosts/CORS for the actual domains. Production/staging also requires `DEBUG=false`, `STAFF_MFA_REQUIRED=true`, `RATE_LIMIT_BACKEND=redis`, secure PostgreSQL/Redis credentials, and a strong metrics bearer token when metrics are enabled.

## 3. Databases and Redis

`POSTGRES_DB` is the Odoo database by default and `APP_POSTGRES_DB` is the FastAPI application database. They **must be different**.

Redis DB usage is separated by URL construction for application/rate-limit and Celery broker/result workloads. Use a generated production Redis password.

## 4. Odoo

Enable only after providing the Odoo URL/database/API user/key and, for inbound connector callbacks, a strong `ODOO_WEBHOOK_SECRET`. The repository Compose topology mounts the bundled `odoo/addons` directory into Odoo 17.

Production/staging must prove real FastAPI↔Odoo connectivity and signed/idempotent event delivery.

## 5. Paymob

Paymob is the primary payment provider. When enabled, configure:

- secret/public keys and HMAC secret;
- positive card and wallet payment method IDs;
- Paymob base/unified-checkout HTTPS URLs;
- public HTTPS notification and redirection URLs;
- three-letter currency (normally EGP).

The backend fails startup for incomplete/unsafe enabled Paymob configuration. A browser redirect is not payment confirmation; verified backend/provider processing is authoritative.

Legacy `STRIPE_*` variables remain only for isolated compatibility/history and are not required for the Paymob primary path.

## 6. Authentication providers

Google and Apple client IDs configure social identity flows. Browser-public client identifiers use the corresponding `NEXT_PUBLIC_*` settings where required. Provider secrets/tokens stay server-side/provider-side and must not be embedded in the frontend.

Phone OTP delivery can use Twilio. Configure account auth token and sender or messaging-service identifiers in the target environment and test real delivery before launch.

## 7. Email and optional providers

SendGrid and ZeptoMail are optional implemented task adapters and require their enable flag plus valid API/sender configuration. Algolia is an optional search-index adapter. Zoho is currently a planned/configuration surface, not a proven runtime CRM adapter. Typeform is a planned warranty/RMA intake adapter. Hedera is intentionally fail-closed: `HEDERA_ENABLED=true` is unsupported until real submission behavior exists.

## 8. Media storage

Development can use `MEDIA_STORAGE_PROVIDER=local`. S3-compatible mode requires a bucket, region and CDN base URL. Outside development, the CDN URL must use HTTPS. `S3_ENDPOINT_URL`, when provided, must be HTTPS or an explicitly allowed internal service URL.

Use IAM/runtime credential mechanisms for object storage; do not add access keys to source code.

## 9. Observability

Metrics are enabled/configurable and should be scraped using the bearer credential when protected. OpenTelemetry export is optional and its endpoint must be HTTPS or an allowed internal service URL. Never include secrets/PII in metric labels or trace attributes.

## 10. Frontend public configuration

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and optional public media/OAuth identifiers are browser-visible/build-time values. Production Compose requires the public site/API URLs.

## 11. Validate before deployment

```bash
python3 scripts/check_repository_hygiene.py
python3 scripts/validate_documentation.py

cd backend
python -m ruff check .
python -m pytest app/tests -q
python -m alembic upgrade head

cd ../frontend
npm ci
npm run verify
npm run build

cd ../infrastructure
docker compose --env-file ../.env   -f docker-compose.yml   -f docker-compose.prod.yml config
```

For staging/production, continue with [`docs/GO_LIVE_RUNBOOK.md`](docs/GO_LIVE_RUNBOOK.md). Do not record real credentials or private provider dashboards in Git.

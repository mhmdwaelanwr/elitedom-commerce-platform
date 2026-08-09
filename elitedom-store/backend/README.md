# Elitedom Backend

FastAPI application for Elitedom commerce, identity, payments, fulfillment, administration, integrations, and operational health controls.

## Runtime boundary

This directory owns the application API and its PostgreSQL schema. Odoo remains an external ERP boundary reached through the integration layer; the storefront consumes the API rather than database internals.

## Layout

```text
backend/
├── alembic/              # Versioned PostgreSQL migrations
├── app/
│   ├── core/             # Configuration, security, infrastructure primitives
│   ├── integrations/     # Provider adapters and asynchronous integration tasks
│   ├── modules/          # Business/domain modules and API routers
│   ├── scripts/          # Backend administrative/development entry points
│   └── tests/            # Unit, API, integration, and contract coverage
├── alembic.ini
├── pyproject.toml
├── requirements.txt
└── requirements-dev.txt
```

## Development

From `elitedom-store/`:

```bash
make dev
make migrate
make lint
make test
```

For direct backend execution, install `requirements-dev.txt`, set the required environment variables from `../.env.example`, and run commands from this directory so `app` is importable.

## Sentry error and performance monitoring

Sentry is disabled unless `SENTRY_ENABLED=true`. FastAPI and Celery share the
PII-safe initialization in `app/sentry_monitoring.py`; request bodies, cookies,
query strings, authorization data, task arguments, and local variables are not
sent. Health and metrics routes are excluded from performance sampling.

Set these values in the deployment secret store, never in source control:

```dotenv
SENTRY_ENABLED=true
SENTRY_DSN=https://<public-key>@<sentry-host>/<project-id>
SENTRY_RELEASE=<deployed-git-commit-sha>
SENTRY_ERROR_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

The existing `ENVIRONMENT` value is used for Sentry environment separation.
In staging and production, enabling Sentry without a valid HTTPS DSN and a
release identifier fails configuration validation before the service starts.

## Database changes

All durable schema changes require Alembic migrations. A migration is not complete until the repository migration smoke test can:

1. upgrade a fresh PostgreSQL database;
2. downgrade and replay the latest migration; and
3. perform the full downgrade/replay sequence supported by the repository.

Do not edit an already-shipped migration to represent a later schema change.

## Security and integrations

Provider credentials stay server-side and enter through environment configuration. Webhook handlers must verify authenticity, fail closed, and remain idempotent. Staff authorization is database-authoritative; client or token role claims are not sufficient to grant permissions.

## Source of truth

- Application entry point: `app/main.py`
- Configuration: `app/core/config.py`
- Database migrations: `alembic/versions/`
- Tests: `app/tests/`
- Architecture: `../../docs/architecture/README.md`
- API documentation: `../../docs/architecture/api/API_SPECIFICATION.md`
- Engineering standards: `../../docs/engineering/development/DEVELOPMENT_GUIDELINES.md`

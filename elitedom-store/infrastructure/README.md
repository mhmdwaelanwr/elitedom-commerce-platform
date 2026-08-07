# Elitedom Infrastructure

Docker Compose topology and environment-specific orchestration for the Elitedom platform.

## Files

```text
infrastructure/
├── docker-compose.yml       # Shared service topology
├── docker-compose.dev.yml   # Development overrides
├── docker-compose.prod.yml  # Production overrides
└── scripts/                 # Infrastructure lifecycle and recovery helpers
```

The base Compose file defines the shared platform services. Development and production behavior is expressed through explicit override files instead of maintaining unrelated topologies.

## Supported entry points

Run lifecycle commands from `elitedom-store/` through the Makefile so the correct Compose files and environment file are selected consistently:

```bash
make dev
make stop
make logs
make prod-config
make prod-up
make prod-down
```

`make prod-config` is the minimum static deployment-topology check before a production deployment. Repository CI validates both development and production Compose configurations.

## Configuration

Local and deployment configuration starts from `../.env.example`. Real `.env` files, credentials, provider tokens, private URLs, and production secrets must not be committed.

Production configuration is expected to fail closed when required security or provider settings are incomplete. Environment-specific acceptance remains separate from repository CI and is recorded through the launch-control process.

## Operational boundaries

- PostgreSQL data is durable state and requires backup/restore planning before destructive operations.
- Redis is runtime infrastructure for caching/rate limiting/task delivery and must be protected by deployment configuration.
- Odoo has its own database and addon lifecycle; application-database migrations do not replace Odoo module upgrades.
- Public launch requires HTTPS, health/readiness verification, provider acceptance, monitoring, and rollback evidence.

## Source of truth

- Compose topology: `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
- Developer commands: `../Makefile`
- Environment contract: `../.env.example`
- Deployment documentation: `../../docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- Go-live runbook: `../docs/GO_LIVE_RUNBOOK.md`

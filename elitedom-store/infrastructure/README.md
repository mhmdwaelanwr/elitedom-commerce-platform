# Elitedom Infrastructure

Docker Compose topology and environment-specific orchestration for the Elitedom platform.

## Files

```text
infrastructure/
├── docker-compose.yml       # Shared service topology
├── docker-compose.dev.yml   # Development overrides
├── docker-compose.prod.yml  # Production overrides
└── scripts/
    ├── backup.sh            # Low-level PostgreSQL backup helper
    ├── restore.sh           # Explicit recovery helper
    └── deploy_release.sh    # Guarded staging/production release execution
```

The base Compose file defines the shared platform services. Development and production behavior is expressed through explicit override files instead of maintaining unrelated topologies.

## Supported entry points

Local lifecycle commands run from `elitedom-store/` through the Makefile:

```bash
make dev
make stop
make logs
make prod-config
make prod-up
make prod-down
```

`make prod-config` is the minimum static deployment-topology check. Repository CI validates both development and production Compose configurations.

Environment deployment uses `.github/workflows/deploy.yml`, not an ad-hoc SSH command. The workflow selects a protected GitHub Environment, validates an immutable full Git SHA, pins SSH host identity, and uploads the repository `deploy_release.sh` helper for one execution. On successful deployment it automatically calls the existing Launch Smoke workflow for the same release.

## Configuration

Local and deployment configuration starts from `../.env.example`. Real `.env` files, credentials, provider tokens, private URLs, and production secrets must not be committed.

The VPS keeps `../.env` locally with mode `600` or `640`. GitHub Environment secrets provide only the SSH connection contract; provider/database/application secrets remain in the protected host configuration unless a future secret-manager migration explicitly changes that model.

Required GitHub Environment secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PRIVATE_KEY`, and pinned `DEPLOY_KNOWN_HOSTS`. Required environment variables: `DEPLOY_PATH`, `SITE_URL`, and `API_URL`.

## Deployment safety boundaries

- Only a full 40-character commit reachable from `origin/main` may be deployed.
- Tracked local modifications on the VPS block deployment; the deployer never uses `git reset --hard` or `git clean`.
- Production Compose is validated before durable-state changes.
- The application and Odoo databases are backed up and gzip-verified before Alembic/Odoo upgrade steps.
- The deployer does not automatically downgrade or restore databases on failure.
- Compose must reach healthy state before the Odoo smoke runs.
- Public release readiness is determined by the chained Launch Smoke, not by SSH success alone.

## Operational boundaries

- PostgreSQL data is durable state and requires backup/restore planning before destructive operations.
- Redis is runtime infrastructure for caching/rate limiting/task delivery and must be protected by deployment configuration.
- Odoo has its own database and addon lifecycle; application-database migrations do not replace Odoo module upgrades.
- Public launch requires HTTPS, exact release provenance, health/readiness verification, provider acceptance, monitoring, and rollback evidence.

## Source of truth

- Compose topology: `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
- Remote release executor: `scripts/deploy_release.sh`
- Developer commands: `../Makefile`
- Environment contract: `../.env.example`
- GitHub deployment workflow: `../../.github/workflows/deploy.yml`
- Deployment documentation: `../../docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- Go-live runbook: `../docs/GO_LIVE_RUNBOOK.md`

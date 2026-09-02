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

Environment deployment uses `.github/workflows/deploy.yml`, not an ad-hoc SSH command. The workflow selects a protected GitHub Environment, validates an immutable full Git SHA, pins SSH host identity, generates an ephemeral SSH key for the run, sends the public key through EC2 Instance Connect, and uploads the repository `deploy_release.sh` helper for one execution. On successful deployment it automatically calls the existing Launch Smoke workflow for the same release.

Qualified `main` releases can also trigger `.github/workflows/staging-auto-deploy.yml` after `Real Stack E2E` succeeds. Automatic staging promotion remains disabled unless the repository variable `STAGING_AUTO_DEPLOY_ENABLED` is explicitly set to `true`; first staging commissioning should therefore be manual and evidence-backed.

## Configuration

Local and deployment configuration starts from `../.env.example`. Real `.env` files, credentials, provider tokens, private URLs, and production secrets must not be committed.

The VPS keeps `../.env` locally with mode `600` or `640`. GitHub Environment secrets provide only the remote deployment target contract; provider/database/application secrets remain in the protected host configuration unless a future secret-manager migration explicitly changes that model.

Required GitHub Environment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KNOWN_HOSTS` — pinned OpenSSH known-hosts content
- `EC2_INSTANCE_ID`

Required GitHub Environment variables:

- `DEPLOY_PATH`
- `SITE_URL`
- `API_URL`
- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME`
- `EC2_SECURITY_GROUP_ID`
- `REQUIRE_ODOO_SMOKE`

The workflow uses GitHub OIDC for AWS credentials. It temporarily authorizes the current GitHub runner public IPv4 as a `/32` SSH ingress rule and uses EC2 Instance Connect to push the ephemeral public key. Final cleanup always attempts to revoke the captured rule and also performs a tag-based fallback lookup for `Name=elitedom-ci-runner` plus `EphemeralRunner=true`; the next deployment removes any matching stale rule before authorizing a new one. A persistent SSH private key is not part of the current deployment contract.

## Deployment safety boundaries

- Only a full 40-character commit reachable from `origin/main` may be deployed.
- Tracked local modifications on the VPS block deployment; the deployer never uses `git reset --hard` or `git clean`.
- SSH host identity is pinned through `DEPLOY_KNOWN_HOSTS`; runtime host-key learning is not trusted.
- GitHub Actions uses an ephemeral SSH key plus EC2 Instance Connect instead of a stored deployment private key.
- Temporary SSH ingress is runner-IP `/32` scoped; cleanup attempts direct revocation plus a workflow-tagged fallback, and the next run removes any matching stale rule before opening new ingress.
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
- Qualified staging promoter: `../../.github/workflows/staging-auto-deploy.yml`
- Deployment documentation: `../../docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- Go-live runbook: `../docs/GO_LIVE_RUNBOOK.md`

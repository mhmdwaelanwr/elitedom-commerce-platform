# Elitedom Infrastructure

Docker Compose topology and controlled environment-specific orchestration for the Elitedom platform.

## Files

```text
infrastructure/
├── docker-compose.yml       # Shared service topology
├── docker-compose.dev.yml   # Development overrides
├── docker-compose.prod.yml  # Hardened staging/production overrides
└── scripts/
    ├── backup.sh            # Low-level PostgreSQL backup helper
    ├── restore.sh           # Explicit destructive recovery helper
    ├── restore_drill.sh     # Isolated non-destructive app/Odoo restore drill
    ├── preflight_host.sh    # Read-only existing-host readiness audit
    └── deploy_release.sh    # Guarded exact-SHA staging/production execution
```

The base Compose file defines the shared platform services. Development uses its explicit override. Staging and production share the hardened `docker-compose.prod.yml` overlay but retain distinct `ENVIRONMENT` identities; staging does not identify as production.

## Supported local entry points

Local lifecycle commands run from `elitedom-store/` through the Makefile:

```bash
make dev
make stop
make logs
make prod-config
make prod-up
make prod-down
```

`make prod-config` validates the hardened Compose topology. Repository CI validates both development and hardened deployment configurations.

## Deployment entry points

Protected deployment uses `.github/workflows/deploy.yml`. It remains manually dispatchable and is also reusable by `.github/workflows/staging-auto-deploy.yml`.

The automatic staging promoter runs only after a successful main-branch `Real Stack E2E` qualification and deploys that workflow run's exact SHA. It remains disabled unless repository variable `STAGING_AUTO_DEPLOY_ENABLED=true`. Production is not an automatic target.

The deployment workflow:

- checks out deployment tooling from the exact release SHA;
- validates the SHA is reachable from `main`;
- selects a protected GitHub Environment;
- optionally uses GitHub OIDC to create one temporary TCP/22 AWS security-group rule for the current runner IPv4 `/32` and revokes that exact rule after SSH work;
- pins SSH host identity rather than trusting runtime discovery;
- runs the non-mutating host preflight;
- invokes the guarded remote release executor;
- retains preflight/deployment evidence;
- invokes the public Launch Smoke for the same SHA after remote success.

## Existing-host preflight

`preflight_host.sh` is designed for a host that is already provisioned. It validates OS/architecture/resources, Docker/Compose/Git, full clone, clean tracked tree, `.env` identity/permissions/hardening, public port exposure, hardened Compose configuration and external deployment-state/backup directory safety.

It does not install packages, edit `.env`, restart services, change firewall rules or remove containers/volumes.

Example:

```bash
elitedom-store/infrastructure/scripts/preflight_host.sh \
  /opt/elitedom \
  staging \
  https://STAGING_SITE_ORIGIN \
  https://STAGING_API_ORIGIN
```

## Configuration

Local and deployment configuration starts from `../.env.example`. Real `.env` files, credentials, provider tokens, private URLs and production/staging secrets must not be committed.

The VPS keeps `../.env` locally with mode `600` or `640`. Deployment automation never creates or replaces it. The protected target environment and host `.env ENVIRONMENT` must match exactly.

Required GitHub Environment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_KNOWN_HOSTS`

Required GitHub Environment variables:

- `DEPLOY_PATH`
- `SITE_URL`
- `API_URL`
- `MANAGE_SSH_INGRESS`
- `AWS_DEPLOY_ROLE_ARN` when managed SSH ingress is enabled
- `AWS_REGION` when managed SSH ingress is enabled
- `DEPLOY_SECURITY_GROUP_ID` when managed SSH ingress is enabled

Provider/database/application secrets remain in protected host configuration or an approved secret manager.

## Deployment safety boundaries

- Only a full 40-character commit reachable from `origin/main` may be deployed.
- Automatic staging promotion uses the exact SHA that passed Real Stack E2E.
- Tracked local modifications on the VPS block deployment; the deployer never uses `git reset --hard` or `git clean`.
- Deployment blocks when host `.env ENVIRONMENT` differs from the protected GitHub Environment.
- The host `.env` is never overwritten.
- Hardened Compose is validated before durable-state changes.
- Application and Odoo databases are backed up and gzip-verified before Alembic/Odoo upgrade steps.
- The deployer does not automatically downgrade or restore databases on failure.
- Compose must reach healthy state before the Odoo smoke runs.
- No deployment path runs `docker compose down -v`.
- Public release readiness is determined by the chained HTTPS Launch Smoke, not by SSH success alone.

## Restore drill

`restore_drill.sh` accepts an application and Odoo `.sql.gz` backup and restores them into a disposable PostgreSQL 15 container with no network connectivity, no published ports, a unique temporary volume and separate isolated databases. It verifies both restored databases contain user tables, then removes only its own disposable resources.

The drill never loads the live `.env`, joins the live Compose project or invokes `restore.sh`. The latter remains reserved for an explicitly approved destructive recovery.

## Operational boundaries

- PostgreSQL and Odoo data are durable state and require backup/restore evidence before production launch.
- Redis is runtime infrastructure for caching/rate limiting/task delivery and remains private.
- Odoo has its own database/addon lifecycle; application migrations do not replace Odoo module upgrades.
- Reverse-proxy/admin-tool management ports must remain non-public.
- Staging provider credentials/data/evidence are not production credentials/data/evidence.
- Public launch requires stable addressing, DNS/TLS, exact release provenance, health/readiness, provider acceptance, monitoring and rollback evidence.

## Source of truth

- Compose topology: `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
- Host readiness: `scripts/preflight_host.sh`
- Remote release executor: `scripts/deploy_release.sh`
- Restore exercise: `scripts/restore_drill.sh`
- Developer commands: `../Makefile`
- Environment contract: `../.env.example`
- Protected deployment: `../../.github/workflows/deploy.yml`
- Automatic staging promotion: `../../.github/workflows/staging-auto-deploy.yml`
- Deployment documentation: `../../docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- Go-live runbook: `../docs/GO_LIVE_RUNBOOK.md`

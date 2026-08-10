---
title: "Go-Live Runbook"
status: operational
owner: operations
document_type: implementation-reference
verified_against: "P24 staging readiness and qualified auto-promotion contract"
review_trigger: "Release controls, environment identity, deployment topology, AWS/SSH access, provider acceptance, rollback, recovery, or launch evidence requirements change."
---

# Go-Live Runbook

## Purpose

Defines the controlled path from an immutable release candidate to accepted staging and later public production launch. Repository qualification, protected deployment, public smoke, provider acceptance, human UAT, monitoring and recovery evidence are distinct gates and must not be substituted for each other.

## Current environment boundary

The existing AWS EC2 host is the staging environment. It uses the hardened Compose overlay with `ENVIRONMENT=staging`. A future production environment must use a separate host and separate credentials/data/evidence.

P23 qualifies code in an isolated CI full stack. P24 adds existing-host preflight, exact-qualified-SHA staging promotion, AWS OIDC temporary SSH ingress and an isolated restore drill. Green P23/P24 repository checks do not prove that the real staging host has been commissioned.

## Entry criteria

Before the first official staging deployment:

- identify the exact full 40-character `release_ref` qualified by a successful main-branch Real Stack E2E run;
- associate a stable network identity with the EC2 staging host rather than relying on an auto-assigned public IPv4;
- configure final staging DNS and TLS origins;
- verify a dedicated deployment SSH identity and pinned host key for the stable target;
- configure the lowercase protected GitHub Environment `staging`;
- configure the GitHub OIDC/AWS least-privilege role when managed temporary SSH ingress is enabled;
- edit the existing host `.env` in place so it identifies as `staging` and matches the final public origins;
- keep repository variable `STAGING_AUTO_DEPLOY_ENABLED=false` until one manual commissioning deployment succeeds.

Do not reuse launch evidence from a different release reference or environment.

## Launch control model

The admin launch-control plane combines automatic configuration gates with evidence-backed operator gates. Required operator gates record a result, verifier, timestamp, notes and evidence reference for the exact release/environment.

The launch gate set includes:

- English storefront UAT;
- Arabic/RTL storefront UAT;
- responsive/accessibility smoke;
- Paymob payment/webhook/refund acceptance;
- Google Sign-In acceptance;
- Apple Sign-In acceptance;
- Twilio OTP acceptance;
- enabled email-provider acceptance;
- Odoo order/stock round-trip acceptance;
- fulfillment, delivery, return and refund UAT;
- PostgreSQL application/Odoo backup and restore drill;
- monitoring/log/alert routing verification;
- rollback drill.

A disabled optional provider should be recorded as disabled; it is not silently considered passed.

## Stable host and SSH commissioning

Before populating final `DEPLOY_HOST`, assign the staging EC2 instance a stable Elastic IP or equivalent stable network identity. Confirm the operator's existing SSH path still works after the address change.

Create a dedicated Ed25519 deployment key out of band. Install only its public key in the staging `ubuntu` account and store only its private key in the GitHub `staging` Environment secret `DEPLOY_SSH_PRIVATE_KEY`.

Independently verify the SSH host-key fingerprint after the stable network identity is assigned, then store the corresponding known-hosts line as `DEPLOY_KNOWN_HOSTS`. Do not trust a key collected inside the same deployment run.

## GitHub Environment contract

The `staging` Environment requires these secrets:

- `DEPLOY_HOST`;
- `DEPLOY_USER`;
- `DEPLOY_SSH_PRIVATE_KEY`;
- `DEPLOY_KNOWN_HOSTS`.

It requires these variables:

- `DEPLOY_PATH=/opt/elitedom`;
- `SITE_URL` — final public HTTPS storefront origin;
- `API_URL` — final public HTTPS API origin without `/api/v1`;
- `MANAGE_SSH_INGRESS=true` for the current AWS security-group model;
- `AWS_DEPLOY_ROLE_ARN`;
- `AWS_REGION=eu-central-1`;
- `DEPLOY_SECURITY_GROUP_ID`.

Application/provider/database secrets remain in the host `.env` or an approved secret manager. The workflow never uploads or replaces the host `.env`.

## AWS OIDC and temporary runner SSH

The current EC2 security group keeps normal SSH access restricted to the operator path. GitHub-hosted runners therefore use a short-lived deployment exception rather than a broad IP allowlist.

When `MANAGE_SSH_INGRESS=true`, `.github/workflows/deploy.yml`:

1. requests a GitHub OIDC token using `id-token: write`;
2. assumes `AWS_DEPLOY_ROLE_ARN` through `aws-actions/configure-aws-credentials@v6`;
3. obtains and validates the current runner IPv4;
4. authorizes exactly one TCP/22 security-group rule for that IPv4 `/32`;
5. captures the AWS `SecurityGroupRuleId` returned for that rule;
6. performs the SSH preflight and deployment;
7. runs an `always()` cleanup that revokes that exact rule ID.

The role should be limited to authorize/revoke ingress on the one staging security group. It does not need EC2 lifecycle, database, secret or IAM mutation rights.

The current repository OIDC prefix is:

```text
repo:mhmdwaelanwr@179792006/elitedom-erp-architecture@1324616964
```

Because deployment uses GitHub Environment `staging`, the AWS role trust policy must bind the subject to:

```text
repo:mhmdwaelanwr@179792006/elitedom-erp-architecture@1324616964:environment:staging
```

with audience `sts.amazonaws.com`.

## Host configuration before first deployment

The manually bootstrapped host currently needs an intentional staging identity before P24 can accept it. Edit the existing `/opt/elitedom/elitedom-store/.env` in place; do not replace it.

At minimum:

- set `ENVIRONMENT=staging`;
- keep `DEBUG=false`;
- keep `STAFF_MFA_REQUIRED=true`;
- keep `RATE_LIMIT_BACKEND=redis`;
- keep the existing trusted internal reverse-proxy IP configuration;
- keep `127.0.0.1,localhost` in `ALLOWED_HOSTS` and add the final staging API hostname;
- set `CORS_ORIGINS` to include the final staging storefront HTTPS origin;
- set `VITE_SITE_URL` to the final staging storefront HTTPS origin;
- set `VITE_API_URL` to the final staging API HTTPS origin plus `/api/v1`;
- preserve the existing strong local application/JWT/PostgreSQL/Redis secrets and strict file mode;
- keep providers disabled until their staging credentials/callbacks are ready.

The hardened Compose overlay preserves `ENVIRONMENT=staging` while still forcing non-development safety controls such as debug off, staff MFA and Redis rate limiting.

## Existing-host preflight

Before every deployment, the workflow copies and runs `elitedom-store/infrastructure/scripts/preflight_host.sh`. The script is non-mutating and checks:

- supported Linux/Ubuntu-Debian x86_64 host and resource floors;
- Git, Docker, Compose and Docker-daemon access;
- full non-shallow canonical checkout at `DEPLOY_PATH`;
- clean tracked working tree;
- `.env` regular-file/non-symlink status and mode `600` or `640`;
- `.env ENVIRONMENT` exactly matches the protected target Environment;
- `DEBUG=false`, staff MFA, Redis rate limiting and trusted proxy configuration;
- core secret presence without printing secret values;
- health-check host allowances for `127.0.0.1` and `localhost`;
- final site CORS/API host agreement when public origins are supplied;
- hardened Compose validation;
- safe deployment state/backup directories;
- no public publication of PostgreSQL, Redis, FastAPI, Odoo, frontend or management ports.

The preflight does not install packages, edit `.env`, restart services, alter firewall/security-group state or delete containers/volumes.

## Release qualification and automatic staging

`.github/workflows/real-e2e.yml` qualifies the main SHA using the full isolated stack and P22/P23 browser/UAT gates.

`.github/workflows/staging-auto-deploy.yml` may automatically promote only when:

- Real Stack E2E completed successfully;
- the run was caused by a push to `main`;
- the run's head branch is `main`;
- repository variable `STAGING_AUTO_DEPLOY_ENABLED=true`.

The deployed `release_ref` is the qualification workflow's exact `head_sha`. Production is never an automatic target.

For first commissioning, leave the toggle disabled and use manual `workflow_dispatch` with the exact latest qualified main SHA. Enable automatic staging only after manual protected deployment plus public smoke has been accepted.

## Guarded deployment and migration

`.github/workflows/deploy.yml` is both reusable and manually dispatchable. It checks out deployment tooling from the exact requested release SHA, verifies that checkout matches the input SHA and proves the commit is reachable from `main`.

The remote `deploy_release.sh` then:

1. validates tools, canonical origin, full clone and clean tracked files;
2. reads the last successful `.elitedom-deployment-state/release_ref` when it exists;
3. enforces forward-only normal promotion from the recorded successful release;
4. checks out exactly the requested SHA without deleting untracked host configuration;
5. validates `.env` permissions and requires host environment identity to equal the selected GitHub Environment;
6. validates hardened Compose before durable-state mutation;
7. starts/waits for PostgreSQL and application DB initialization;
8. resolves separate application and Odoo database identities;
9. writes pre-migration application/Odoo dumps outside the repository and validates their gzip streams;
10. builds the requested FastAPI/frontend/Celery images;
11. runs `alembic upgrade head`;
12. upgrades the bundled `elitedom_connector`;
13. starts the hardened topology with bounded health waiting;
14. runs the Odoo integration smoke;
15. verifies the checkout still equals the requested SHA;
16. atomically records the exact release as the last successful deployment.

The deployer does not run `alembic downgrade`, automatic database restore, `git reset --hard`, `git clean`, `.env` replacement or volume deletion. A failed deployment does not advance the recorded release state.

## Public HTTPS smoke

Only after remote deployment succeeds does the workflow invoke `.github/workflows/launch-smoke.yml` for the same `SITE_URL`, `API_URL` and exact `release_ref`.

The smoke verifies public HTTPS reachability, liveness/readiness, defensive headers, exact deployed release provenance, public catalog/media quality and browser behavior. It uses backend-authoritative catalog data and does not mock application API routes.

The deployed browser gate validates real guest cart/checkout rendering and responsive/locale behavior while deliberately stopping before financially meaningful checkout/payment mutation. Payment callbacks, refunds and other provider actions remain explicit provider UAT.

A remote SSH/deploy success without the chained public smoke is not accepted staging evidence.

## Runtime readiness

Verify at minimum:

- storefront serves expected content over the public HTTPS origin;
- `/health/live` reports healthy and the exact deployed Git SHA as `version`;
- `/health/ready` reports all required dependencies ready;
- Celery worker/beat are operating against the intended Redis broker;
- Odoo is reachable through the configured integration boundary;
- only reverse-proxy ports are public and management/data ports remain private;
- logs are available and there is no critical/error storm;
- enabled metrics/tracing/Sentry configuration operates without leaking secrets or PII.

## Provider acceptance

Enable and test each provider only after staging credentials and callback origins are configured.

Acceptance for enabled primary launch paths includes:

- Paymob card/wallet flows, verified callback processing, idempotency, reconciliation state and refund path;
- Google browser sign-in and account-link/profile-completion behavior;
- Apple browser sign-in and account-link/profile-completion behavior;
- Twilio OTP send/verify/resend and abuse-limit behavior;
- enabled email delivery provider behavior;
- Odoo product/inventory/order/shipment round trip and signed webhook behavior.

Provider dashboards may be referenced by evidence identifier, but credentials, tokens, customer PII and private dashboard URLs must not be committed.

## Storefront and administration UAT

P23 already proves automated responsive/RTL/theme/role behavior in an isolated full stack. Staging still requires human environment-specific UAT for the exact deployed release.

Validate English and Arabic, LTR/RTL, light/dark/system appearance, locale-aware EGP display, responsive layouts, loading/empty/error states, keyboard/focus behavior and critical customer/admin journeys.

Critical commerce UAT includes catalog/search/PDP, account/session behavior, cart merging, checkout, payment outcomes, order history/status, fulfillment/shipping, refund/return, warranty/RMA, B2B/RFQ and admin permission boundaries.

## Backup and restore drill

Deployment-time backups prove creation and gzip readability, not recoverability. For staging launch acceptance, select one application and one Odoo dump and run:

```bash
elitedom-store/infrastructure/scripts/restore_drill.sh \
  /path/to/elitedom_TIMESTAMP_app.sql.gz \
  /path/to/elitedom_TIMESTAMP_odoo.sql.gz
```

The drill validates both gzip streams, creates a disposable PostgreSQL 15 container with `--network none`, restores to two isolated databases, verifies user tables and removes only its own disposable resources. It does not load live `.env`, attach to live Compose or invoke the destructive `restore.sh` helper.

Record backup identifiers, drill time, restore result and discrepancies without uploading sensitive backup data.

## Monitoring and alerting

Before accepting staging/provider UAT and before production cutover, prove that operators can observe the release:

- application/proxy/worker/database/Odoo logs are available;
- request correlation is usable where implemented;
- protected metrics work when enabled;
- tracing/Sentry export works when enabled;
- alert routing reaches the intended operator/on-call destination;
- an operator can identify payment, provider, worker and database readiness failures.

## Rollback drill

Normal deployment is deliberately forward-only and is not a rollback mechanism. Do not edit `.elitedom-deployment-state/release_ref` backward to bypass the guard.

Before launch, record:

- previous known-good application release;
- schema compatibility with that release;
- Odoo addon compatibility;
- provider/webhook/DNS configuration that may need reversal;
- traffic reversal procedure;
- recovery owner and stop conditions.

Do not automatically downgrade or restore databases merely because an application rollback is required. If newer code has written incompatible data, use the incident/recovery plan appropriate to actual durable state.

## Staging commissioning sequence

1. Assign stable EC2 addressing.
2. Verify operator SSH and pin the stable target's host key.
3. Install a dedicated deployment SSH public key.
4. Configure AWS GitHub OIDC and the least-privilege security-group role.
5. Populate the `staging` GitHub Environment values.
6. Configure staging DNS and TLS.
7. Edit the existing host `.env` in place to staging identity and final public origins.
8. Select the latest successful main SHA qualified by Real Stack E2E.
9. Manually dispatch `Deploy Release` to `staging` for that exact SHA.
10. Require host preflight, guarded remote deployment and chained Launch Smoke success.
11. Run provider/human UAT, monitoring checks and the isolated restore/rollback drills.
12. Only then enable `STAGING_AUTO_DEPLOY_ENABLED=true` if ongoing automatic qualified staging promotion is desired.

## Production promotion

Production must be a separate environment. Do not repurpose staging data/credentials/evidence as production evidence.

Before production traffic opens, repeat production-specific secrets/provider acceptance, public DNS/TLS, monitoring, backup/restore and rollback evidence for the exact production release. Production deployment remains explicitly protected/manual under the current P24 policy.

## Release sign-off

A release is eligible to open traffic only when all required automatic gates pass and required operator gates contain valid evidence for the same immutable `release_ref` and environment. A waiver is an explicit risk decision and is not equivalent to a passed test.

## Evidence handling

Retain non-secret identifiers for deployment, smoke, backups, restore drills, provider transactions and operational verification. `preflight.log` and `deployment.log` are deployment artifacts; browser/provenance smoke evidence is retained separately. Never copy secrets, private keys, backup contents or customer PII into repository evidence.

## Source of truth

- `.github/workflows/ci.yml`
- `.github/workflows/real-e2e.yml`
- `.github/workflows/staging-auto-deploy.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deployment-contract.yml`
- `.github/workflows/launch-smoke.yml`
- `elitedom-store/infrastructure/docker-compose.prod.yml`
- `elitedom-store/infrastructure/scripts/preflight_host.sh`
- `elitedom-store/infrastructure/scripts/deploy_release.sh`
- `elitedom-store/infrastructure/scripts/restore_drill.sh`
- `elitedom-store/scripts/validate_deployment_assets.py`
- `elitedom-store/scripts/live_smoke.py`
- `elitedom-store/scripts/verify_release.py`
- `elitedom-store/frontend/e2e/launch.spec.mjs`
- `elitedom-store/backend/app/modules/admin/control_service.py`
- `elitedom-store/frontend/src/pages/admin/LaunchControlPage.tsx`
- `docs/operations/infrastructure/ENVIRONMENTS.md`
- `docs/operations/infrastructure/DEPLOYMENT_GUIDE.md`
- `docs/operations/disaster-recovery/RESTORE_PROCEDURES.md`

## Verification

Repository CI proves code/tests/migration/container/launch/deployment-asset contracts. Real Stack E2E/P23 proves isolated full-stack release qualification. Protected deployment plus public exact-SHA smoke proves staging execution. Provider/human/monitoring/recovery evidence proves environment acceptance. None substitutes for the others.

## Change policy

Update this runbook in the same pull request that changes launch gates, environment identity, deployment topology/execution, AWS/SSH access, backup/restore procedure, provider acceptance, public smoke behavior, release-state behavior or rollback requirements. Preserve historical evidence rather than rewriting it to match later environments.

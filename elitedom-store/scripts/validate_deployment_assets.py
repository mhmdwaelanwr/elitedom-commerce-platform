#!/usr/bin/env python3
"""Fail CI if the hardened staging/production deployment contract is weakened."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEPLOY_WORKFLOW = ROOT / ".github/workflows/deploy.yml"
AUTO_STAGING_WORKFLOW = ROOT / ".github/workflows/staging-auto-deploy.yml"
SMOKE_WORKFLOW = ROOT / ".github/workflows/launch-smoke.yml"
DEPLOY_SCRIPT = ROOT / "elitedom-store/infrastructure/scripts/deploy_release.sh"
PREFLIGHT_SCRIPT = ROOT / "elitedom-store/infrastructure/scripts/preflight_host.sh"
RESTORE_DRILL_SCRIPT = ROOT / "elitedom-store/infrastructure/scripts/restore_drill.sh"
PROD_COMPOSE = ROOT / "elitedom-store/infrastructure/docker-compose.prod.yml"
DEPLOY_GUIDE = ROOT / "docs/operations/infrastructure/DEPLOYMENT_GUIDE.md"


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []
    required_assets = (
        DEPLOY_WORKFLOW,
        AUTO_STAGING_WORKFLOW,
        SMOKE_WORKFLOW,
        DEPLOY_SCRIPT,
        PREFLIGHT_SCRIPT,
        RESTORE_DRILL_SCRIPT,
        PROD_COMPOSE,
        DEPLOY_GUIDE,
    )
    for path in required_assets:
        require(path.is_file(), f"Missing deployment asset: {path.relative_to(ROOT)}", errors)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
    for marker, message in (
        ("workflow_dispatch:", "Deployment must remain manually dispatchable."),
        ("workflow_call:", "Deployment must remain reusable by the qualified staging promoter."),
        ("id-token: write", "Deployment must be able to request a short-lived OIDC token."),
        ("environment:", "Deployment must use protected GitHub Environments."),
        ("cancel-in-progress: false", "A running deployment must not be cancelled by a newer promotion."),
        ("ref: ${{ inputs.release_ref }}", "Deployment tooling must be checked out from the exact release SHA."),
        ("DEPLOY_KNOWN_HOSTS", "SSH host identity must be pinned."),
        ("StrictHostKeyChecking=yes", "SSH strict host checking must remain enabled."),
        ("git merge-base --is-ancestor", "Release must be verified as reachable from main."),
        ("aws-actions/configure-aws-credentials@v6", "Temporary SSH ingress must use short-lived AWS OIDC credentials."),
        ("MANAGE_SSH_INGRESS", "Temporary SSH ingress must be explicitly environment-controlled."),
        ("AWS_DEPLOY_ROLE_ARN", "Deployment must receive the least-privilege AWS role ARN from environment variables."),
        ("DEPLOY_SECURITY_GROUP_ID", "Deployment must scope temporary SSH access to an explicit security group."),
        ("https://checkip.amazonaws.com", "Deployment must determine the current runner address for an exact /32 rule."),
        ("${runner_ip}/32", "Temporary runner SSH access must be restricted to one IPv4 /32."),
        ("authorize-security-group-ingress", "Deployment must explicitly authorize the temporary SSH rule."),
        ("SecurityGroupRules[0].SecurityGroupRuleId", "Deployment must capture the exact AWS security-group rule ID it creates."),
        ("revoke-security-group-ingress", "Deployment must revoke temporary runner SSH access."),
        ("--security-group-rule-ids", "Temporary SSH cleanup must revoke by exact rule ID."),
        ("if: always() && env.MANAGE_SSH_INGRESS == 'true'", "Temporary SSH cleanup must run even after deployment failure."),
        ("preflight_host.sh", "Deployment must run the non-mutating host preflight."),
        ("deploy_release.sh", "Workflow must execute the guarded remote deployer."),
        ("TARGET_ENVIRONMENT", "Protected environment identity must reach the remote deployer."),
        ("uses: ./.github/workflows/launch-smoke.yml", "Successful deployment must call the launch smoke gate."),
        ("preflight.log", "Host preflight evidence must be retained."),
        ("deployment.log", "Deployment evidence must be retained."),
    ):
        require(marker in workflow, message, errors)
    require("ssh-keyscan" not in workflow, "Do not trust runtime ssh-keyscan output as host identity.", errors)
    require("StrictHostKeyChecking=no" not in workflow, "Deployment must never disable SSH host verification.", errors)
    require("0.0.0.0/0" not in workflow, "Deployment must never open SSH to the whole IPv4 internet.", errors)
    require("::/0" not in workflow, "Deployment must never open SSH to the whole IPv6 internet.", errors)
    authorize_index = workflow.find("authorize-security-group-ingress")
    ssh_verify_index = workflow.find("Verify remote deployment host")
    revoke_index = workflow.find("revoke-security-group-ingress")
    require(
        authorize_index >= 0 and ssh_verify_index > authorize_index and revoke_index > ssh_verify_index,
        "Temporary SSH access must be authorized before SSH and revoked after SSH work.",
        errors,
    )

    auto_workflow = AUTO_STAGING_WORKFLOW.read_text(encoding="utf-8")
    for marker, message in (
        ("workflow_run:", "Automatic staging promotion must be driven by a completed qualification workflow."),
        ("Real Stack E2E", "Automatic staging promotion must depend on Real Stack E2E."),
        ("id-token: write", "Automatic staging promotion must permit OIDC in the reusable deployment workflow."),
        ("github.event.workflow_run.conclusion == 'success'", "Automatic staging promotion must require a successful qualification."),
        ("github.event.workflow_run.event == 'push'", "Automatic staging promotion must reject PR-originated qualification runs."),
        ("github.event.workflow_run.head_branch == 'main'", "Automatic staging promotion must be limited to main."),
        ("STAGING_AUTO_DEPLOY_ENABLED", "Automatic staging promotion must have an explicit enable switch."),
        ("environment: staging", "Automatic promotion must target staging only."),
        ("github.event.workflow_run.head_sha", "Automatic staging must deploy the exact qualified SHA."),
        ("uses: ./.github/workflows/deploy.yml", "Automatic staging must reuse the guarded deployment workflow."),
    ):
        require(marker in auto_workflow, message, errors)
    require("environment: production" not in auto_workflow, "Production must never be an automatic promotion target.", errors)

    smoke = SMOKE_WORKFLOW.read_text(encoding="utf-8")
    require("workflow_call:" in smoke, "Launch smoke must remain reusable by deployment.", errors)
    require("workflow_dispatch:" in smoke, "Launch smoke must remain manually runnable independently.", errors)

    script = DEPLOY_SCRIPT.read_text(encoding="utf-8")
    for marker, message in (
        ("^[0-9a-fA-F]{40}$", "Remote deployment must require a full Git SHA."),
        ("EXPECTED_ENVIRONMENT", "Remote deployment must receive the protected environment identity."),
        ("host .env ENVIRONMENT must match", "Remote deployment must reject environment identity drift."),
        ("git merge-base --is-ancestor", "Remote deployment must verify Git ancestry."),
        ("git status --porcelain --untracked-files=no", "Remote deployment must reject tracked local changes."),
        ("git rev-parse --is-shallow-repository", "Deployment must reject shallow repositories before ancestry checks."),
        ("$(dirname \"$REPO_PATH\")/.elitedom-deployment-state", "Successful deployment state must live outside the repository checkout."),
        ("normal deployment is forward-only", "Normal deployment must reject a move behind the last successful release."),
        ("deployment state contains an invalid release ref", "Persisted deployment state must be validated before use."),
        ("deployment .env permissions must be 600 or 640", "Deployment environment file permissions must be constrained."),
        ("config --quiet", "Hardened Compose must be validated before mutation."),
        ("Backing up", "Database backup must occur before migration."),
        ("gzip -t", "Generated database backups must be integrity checked."),
        ("alembic upgrade head", "Application migrations must run during deployment."),
        ("-u elitedom_connector", "Odoo connector upgrade must run during deployment."),
        ("--wait --wait-timeout 300", "Deployment must wait for service health."),
        ("app.scripts.check_odoo", "Deployment must run the Odoo integration smoke."),
        ("mv -f \"$state_tmp\" \"$STATE_FILE\"", "Deployment state must be committed atomically after success."),
    ):
        require(marker in script, message, errors)
    require("alembic downgrade" not in script, "Deployment must not auto-downgrade the database.", errors)
    require("restore.sh" not in script, "Deployment must not auto-restore durable state on failure.", errors)
    require("git reset --hard" not in script, "Deployment must not discard host changes destructively.", errors)
    require("git clean" not in script, "Deployment must not delete untracked host configuration.", errors)

    odoo_smoke_index = script.find("app.scripts.check_odoo")
    state_commit_index = script.find('mv -f "$state_tmp" "$STATE_FILE"')
    require(
        odoo_smoke_index >= 0 and state_commit_index > odoo_smoke_index,
        "The last-successful release state must only be written after runtime/Odoo verification.",
        errors,
    )

    preflight = PREFLIGHT_SCRIPT.read_text(encoding="utf-8")
    for marker, message in (
        ("Non-mutating readiness audit", "Host preflight must explicitly preserve its read-only contract."),
        ("git rev-parse --is-shallow-repository", "Preflight must reject shallow deployment repositories."),
        ("git status --porcelain --untracked-files=no", "Preflight must detect tracked host changes."),
        (".env permissions must be 600 or 640", "Preflight must validate .env permissions."),
        ("ENVIRONMENT must be", "Preflight must validate environment identity."),
        ("STAFF_MFA_REQUIRED", "Preflight must validate staff MFA hardening."),
        ("RATE_LIMIT_BACKEND", "Preflight must validate Redis-backed rate limiting."),
        ("ALLOWED_HOSTS must include 127.0.0.1", "Preflight must protect container health-check host handling."),
        ("config --quiet", "Preflight must validate hardened Compose without starting it."),
        ("sensitive port", "Preflight must reject sensitive public port publication."),
    ):
        require(marker in preflight, message, errors)
    for forbidden in (
        "apt-get ",
        "apt install",
        "systemctl ",
        "ufw ",
        "docker compose down",
        "docker volume rm",
        "git reset",
        "git clean",
        "sed -i",
    ):
        require(forbidden not in preflight, f"Host preflight must remain non-mutating: {forbidden.strip()}", errors)

    restore_drill = RESTORE_DRILL_SCRIPT.read_text(encoding="utf-8")
    for marker, message in (
        ("--network none", "Restore drill target must have no network connectivity."),
        ("docker volume create", "Restore drill must use a disposable dedicated volume."),
        ("docker volume rm", "Restore drill must clean up only its disposable volume."),
        ("gzip -t", "Restore drill must validate both backup streams before restoring."),
        ("elitedom_restore_drill_app", "Restore drill must use a distinct isolated app database."),
        ("elitedom_restore_drill_odoo", "Restore drill must use a distinct isolated Odoo database."),
        ("pg_tables", "Restore drill must verify restored user tables."),
    ):
        require(marker in restore_drill, message, errors)
    require("docker compose" not in restore_drill, "Restore drill must never attach to the live Compose project.", errors)
    require("restore.sh" not in restore_drill, "Restore drill must never invoke the destructive restore helper.", errors)
    require(".env" not in restore_drill, "Restore drill must not load live environment configuration.", errors)

    compose = PROD_COMPOSE.read_text(encoding="utf-8")
    require(
        compose.count('ENVIRONMENT: "${ENVIRONMENT:-production}"') >= 3,
        "Hardened Compose must preserve staging/production runtime identity for API and workers.",
        errors,
    )
    require("ENVIRONMENT: production" not in compose, "Hardened Compose must not force staging to identify as production.", errors)
    require('DEBUG: "false"' in compose, "Hardened Compose must keep debug disabled.", errors)
    require('STAFF_MFA_REQUIRED: "true"' in compose, "Hardened Compose must keep staff MFA enabled.", errors)
    require("RATE_LIMIT_BACKEND: redis" in compose, "Hardened Compose must keep Redis rate limiting.", errors)

    guide = DEPLOY_GUIDE.read_text(encoding="utf-8")
    for marker, message in (
        ("GitHub Environment", "Deployment guide must document the protected environment contract."),
        ("DEPLOY_KNOWN_HOSTS", "Deployment guide must document pinned SSH host identity."),
        ("release_ref", "Deployment guide must document the immutable release reference."),
        ("forward-only", "Deployment guide must document the forward-only normal deployment boundary."),
        (".elitedom-deployment-state", "Deployment guide must document persisted last-successful release state."),
        ("STAGING_AUTO_DEPLOY_ENABLED", "Deployment guide must document the staging auto-deploy enable switch."),
        ("preflight_host.sh", "Deployment guide must document host preflight."),
        ("restore_drill.sh", "Deployment guide must document the isolated restore drill."),
        ("AWS_DEPLOY_ROLE_ARN", "Deployment guide must document the OIDC deployment role contract."),
        ("DEPLOY_SECURITY_GROUP_ID", "Deployment guide must document the security group used for temporary runner access."),
        ("/32", "Deployment guide must document exact-runner temporary SSH ingress."),
    ):
        require(marker in guide, message, errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("P24 staging/production deployment assets validated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

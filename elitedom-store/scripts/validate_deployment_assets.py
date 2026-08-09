#!/usr/bin/env python3
"""Fail CI if the protected single-VPS deployment contract is weakened."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEPLOY_WORKFLOW = ROOT / ".github/workflows/deploy.yml"
SMOKE_WORKFLOW = ROOT / ".github/workflows/launch-smoke.yml"
DEPLOY_SCRIPT = ROOT / "elitedom-store/infrastructure/scripts/deploy_release.sh"
DEPLOY_GUIDE = ROOT / "docs/operations/infrastructure/DEPLOYMENT_GUIDE.md"


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []
    for path in (DEPLOY_WORKFLOW, SMOKE_WORKFLOW, DEPLOY_SCRIPT, DEPLOY_GUIDE):
        require(path.is_file(), f"Missing deployment asset: {path.relative_to(ROOT)}", errors)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
    for marker, message in (
        ("workflow_dispatch:", "Deployment must remain explicitly dispatched."),
        ("environment:", "Deployment must use protected GitHub Environments."),
        ("cancel-in-progress: false", "A running deployment must not be cancelled by a newer dispatch."),
        ("DEPLOY_KNOWN_HOSTS", "SSH host identity must be pinned."),
        ("StrictHostKeyChecking=yes", "SSH strict host checking must remain enabled."),
        ("git merge-base --is-ancestor", "Release must be verified as reachable from main."),
        ("deploy_release.sh", "Workflow must execute the guarded remote deployer."),
        ("uses: ./.github/workflows/launch-smoke.yml", "Successful deployment must call the launch smoke gate."),
        ("deployment.log", "Deployment evidence must be retained."),
    ):
        require(marker in workflow, message, errors)
    require("ssh-keyscan" not in workflow, "Do not trust runtime ssh-keyscan output as host identity.", errors)
    require("StrictHostKeyChecking=no" not in workflow, "Deployment must never disable SSH host verification.", errors)

    smoke = SMOKE_WORKFLOW.read_text(encoding="utf-8")
    require("workflow_call:" in smoke, "Launch smoke must remain reusable by deployment.", errors)
    require("workflow_dispatch:" in smoke, "Launch smoke must remain manually runnable independently.", errors)

    script = DEPLOY_SCRIPT.read_text(encoding="utf-8")
    for marker, message in (
        ("^[0-9a-fA-F]{40}$", "Remote deployment must require a full Git SHA."),
        ("git merge-base --is-ancestor", "Remote deployment must verify Git ancestry."),
        ("git status --porcelain --untracked-files=no", "Remote deployment must reject tracked local changes."),
        ("git rev-parse --is-shallow-repository", "Deployment must reject shallow repositories before ancestry checks."),
        ("$(dirname \"$REPO_PATH\")/.elitedom-deployment-state", "Successful deployment state must live outside the repository checkout."),
        ("normal deployment is forward-only", "Normal deployment must reject a move behind the last successful release."),
        ("deployment state contains an invalid release ref", "Persisted deployment state must be validated before use."),
        ("permissions must be 600 or 640", "Production environment file permissions must be constrained."),
        ("config --quiet", "Production Compose must be validated before mutation."),
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
    require("git clean" not in script, "Deployment must not delete untracked production configuration.", errors)

    odoo_smoke_index = script.find("app.scripts.check_odoo")
    state_commit_index = script.find('mv -f "$state_tmp" "$STATE_FILE"')
    require(
        odoo_smoke_index >= 0 and state_commit_index > odoo_smoke_index,
        "The last-successful release state must only be written after runtime/Odoo verification.",
        errors,
    )

    guide = DEPLOY_GUIDE.read_text(encoding="utf-8")
    require("GitHub Environment" in guide, "Deployment guide must document the protected environment contract.", errors)
    require("DEPLOY_KNOWN_HOSTS" in guide, "Deployment guide must document pinned SSH host identity.", errors)
    require("release_ref" in guide, "Deployment guide must document the immutable release reference.", errors)
    require("forward-only" in guide, "Deployment guide must document the forward-only normal deployment boundary.", errors)
    require(".elitedom-deployment-state" in guide, "Deployment guide must document persisted last-successful release state.", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("P16 deployment execution assets validated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

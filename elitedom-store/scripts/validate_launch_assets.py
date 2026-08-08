#!/usr/bin/env python3
"""Validate that Stage 10 launch-control assets remain wired into the repository."""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "elitedom-store"
STAGE_10_DOC = ROOT / "docs/delivery/releases/STAGE_10_UAT_GO_LIVE.md"
FRONTEND = STORE / "frontend"
LAUNCH_PAGE = FRONTEND / "src/pages/admin/LaunchControlPage.tsx"
SEO_GENERATOR = FRONTEND / "scripts/generate-seo.mjs"

REQUIRED_FILES = (
    ROOT / ".github/workflows/ci.yml",
    ROOT / ".github/workflows/launch-smoke.yml",
    ROOT / "docs/README.md",
    STAGE_10_DOC,
    STORE / "docs/GO_LIVE_RUNBOOK.md",
    STORE / "scripts/live_smoke.py",
    STORE / "backend/alembic/versions/20260807_0014_launch_acceptance.py",
    STORE / "backend/app/tests/integration/test_stage10_launch_acceptance.py",
    FRONTEND / "src/router.tsx",
    LAUNCH_PAGE,
    SEO_GENERATOR,
    FRONTEND / "vite.config.ts",
)

REQUIRED_CI_MARKERS = (
    "Backend (Python 3.11)",
    "Frontend (Node 22)",
    "Odoo 17 addon install and tests",
    "PostgreSQL migration smoke test",
    "Validate Docker Compose",
    "Launch acceptance",
)

REQUIRED_RUNBOOK_MARKERS = (
    "Pre-deployment",
    "Database backup and restore",
    "Provider acceptance",
    "External smoke test",
    "Rollback",
    "Release sign-off",
)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_FILES:
        require(path.is_file(), f"Missing required launch asset: {path.relative_to(ROOT)}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    ci = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    for marker in REQUIRED_CI_MARKERS:
        require(marker in ci, f"CI is missing required job/marker: {marker}", errors)

    smoke_workflow = (ROOT / ".github/workflows/launch-smoke.yml").read_text(encoding="utf-8")
    require("workflow_dispatch:" in smoke_workflow, "Launch smoke must remain manually dispatched.", errors)
    require("live_smoke.py" in smoke_workflow, "Launch smoke workflow must execute live_smoke.py.", errors)
    require("--allow-local" not in smoke_workflow, "Remote launch smoke must never enable local/private targets.", errors)

    smoke_source = (STORE / "scripts/live_smoke.py").read_text(encoding="utf-8")
    try:
        ast.parse(smoke_source)
    except SyntaxError as exc:
        errors.append(f"live_smoke.py is not valid Python: {exc}")
    require("socket.getaddrinfo" in smoke_source, "Live smoke must resolve and reject private network targets.", errors)
    require("_NoRedirectHandler" in smoke_source, "Live smoke must fail closed instead of following redirects.", errors)
    require("health/ready" in smoke_source, "Live smoke must verify dependency readiness.", errors)
    require("robots.txt" in smoke_source and "sitemap.xml" in smoke_source, "Live smoke must verify public SEO assets.", errors)

    seo_generator = SEO_GENERATOR.read_text(encoding="utf-8")
    require("robots.txt" in seo_generator, "React/Vite SEO generator must emit robots.txt.", errors)
    require("sitemap.xml" in seo_generator, "React/Vite SEO generator must emit sitemap.xml.", errors)
    require("VITE_SITE_URL" in seo_generator, "React/Vite SEO assets must use the public VITE_SITE_URL contract.", errors)

    router_source = (FRONTEND / "src/router.tsx").read_text(encoding="utf-8")
    require('path: "/admin/launch"' in router_source, "React Router must expose the launch-control route.", errors)
    require("LaunchControlPage" in router_source, "React Router must map launch control to LaunchControlPage.", errors)

    runbook = (STORE / "docs/GO_LIVE_RUNBOOK.md").read_text(encoding="utf-8")
    for marker in REQUIRED_RUNBOOK_MARKERS:
        require(marker in runbook, f"Go-live runbook is missing section: {marker}", errors)

    stage_doc = STAGE_10_DOC.read_text(encoding="utf-8")
    for marker in (
        "Launch Control Plane",
        "UAT matrix",
        "External smoke",
        "Known live-provider gates",
        "release reference",
    ):
        require(marker in stage_doc, f"Stage 10 documentation is missing: {marker}", errors)

    migration = (STORE / "backend/alembic/versions/20260807_0014_launch_acceptance.py").read_text(encoding="utf-8")
    require('down_revision: str | None = "0013_staff_mfa"' in migration, "Launch migration must extend 0013_staff_mfa.", errors)
    require("def downgrade()" in migration, "Launch acceptance migration must remain reversible.", errors)
    require("release_ref" in migration and "environment" in migration, "Launch acceptance persistence must be scoped by release and environment.", errors)
    require("uq_launch_acceptance_release_environment_key" in migration, "Release-scoped launch evidence must be unique per gate.", errors)

    launch_test = (STORE / "backend/app/tests/integration/test_stage10_launch_acceptance.py").read_text(encoding="utf-8")
    require("test_launch_acceptance_does_not_carry_between_releases" in launch_test, "Backend coverage must prove evidence cannot carry between releases.", errors)

    launch_page = LAUNCH_PAGE.read_text(encoding="utf-8")
    require("config.manage" in launch_page, "Launch UI must preserve config.manage write boundary.", errors)
    require("evidence_ref" in launch_page, "Launch UI must capture evidence references.", errors)
    require("releaseRef" in launch_page, "Launch UI must require an explicit release reference.", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("Stage 10 launch assets validated successfully for the React/Vite frontend.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

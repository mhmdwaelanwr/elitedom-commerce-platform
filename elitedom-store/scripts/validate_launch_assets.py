#!/usr/bin/env python3
"""Validate that launch-control and P15 deployed-browser assets remain wired into the repository."""

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
LAUNCH_E2E_CONFIG = FRONTEND / "playwright.launch.config.mjs"
LAUNCH_E2E_SPEC = FRONTEND / "e2e/launch.spec.mjs"

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
    LAUNCH_E2E_CONFIG,
    LAUNCH_E2E_SPEC,
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
    require(
        "node --check elitedom-store/frontend/e2e/launch.spec.mjs" in ci,
        "CI must syntax-check the deployed browser launch spec.",
        errors,
    )
    require(
        "node --check elitedom-store/frontend/playwright.launch.config.mjs" in ci,
        "CI must syntax-check the Playwright launch config.",
        errors,
    )

    smoke_workflow = (ROOT / ".github/workflows/launch-smoke.yml").read_text(encoding="utf-8")
    require("workflow_dispatch:" in smoke_workflow, "Launch smoke must remain manually dispatched.", errors)
    require("live_smoke.py" in smoke_workflow, "Launch smoke workflow must execute live_smoke.py.", errors)
    require("--allow-local" not in smoke_workflow, "Remote launch smoke must never enable local/private targets.", errors)
    require(
        "@playwright/test@1.55.0" in smoke_workflow,
        "Launch workflow must use the pinned Playwright test runner.",
        errors,
    )
    require(
        "playwright install --with-deps chromium" in smoke_workflow,
        "Launch workflow must provision Chromium explicitly.",
        errors,
    )
    require(
        "playwright test --config=playwright.launch.config.mjs" in smoke_workflow,
        "Launch workflow must execute the real storefront browser gate.",
        errors,
    )
    require(
        "playwright-report" in smoke_workflow and "test-results" in smoke_workflow,
        "Launch workflow must preserve browser evidence on success or failure.",
        errors,
    )

    smoke_source = (STORE / "scripts/live_smoke.py").read_text(encoding="utf-8")
    try:
        ast.parse(smoke_source)
    except SyntaxError as exc:
        errors.append(f"live_smoke.py is not valid Python: {exc}")
    require("socket.getaddrinfo" in smoke_source, "Live smoke must resolve and reject private network targets.", errors)
    require("_NoRedirectHandler" in smoke_source, "Live smoke must fail closed instead of following redirects.", errors)
    require("health/ready" in smoke_source, "Live smoke must verify dependency readiness.", errors)
    require("robots.txt" in smoke_source and "sitemap.xml" in smoke_source, "Live smoke must verify public SEO assets.", errors)

    e2e_config = LAUNCH_E2E_CONFIG.read_text(encoding="utf-8")
    require("ELITEDOM_SITE_URL" in e2e_config, "Browser config must require the deployed storefront origin.", errors)
    require("ELITEDOM_API_URL" in e2e_config, "Browser config must require the deployed API origin.", errors)
    require('url.protocol !== "https:"' in e2e_config, "Browser config must reject non-HTTPS launch targets.", errors)
    require('trace: "retain-on-failure"' in e2e_config, "Browser gate must retain traces on failure.", errors)

    e2e_spec = LAUNCH_E2E_SPEC.read_text(encoding="utf-8")
    for marker, message in (
        ("/catalog/products?locale=en&limit=100", "Browser gate must discover a real product from the catalogue API."),
        ("stock_qty", "Browser gate must require backend stock or dropship availability."),
        ("/api/v1/orders/cart/items", "Browser gate must exercise the real guest-cart mutation path."),
        ("elitedom-locale", "Browser gate must exercise locale and direction behavior."),
        ("scrollWidth", "Browser gate must check horizontal overflow."),
        ("390", "Browser gate must cover the 390px mobile reference width."),
        ("430", "Browser gate must cover the 430px mobile width."),
        ("1024", "Browser gate must cover the tablet width."),
        ('method() === "DELETE"', "Browser gate must clean up its guest-cart item."),
    ):
        require(marker in e2e_spec, message, errors)
    require("page.route(" not in e2e_spec, "Launch browser gate must not mock backend routes.", errors)
    require("route.fulfill(" not in e2e_spec, "Launch browser gate must not fulfill mocked API responses.", errors)

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
    require(
        "deployed browser E2E" in runbook,
        "Go-live runbook must document the deployed browser E2E release gate.",
        errors,
    )

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

    print("Launch assets validated successfully, including P15 deployed browser E2E wiring.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

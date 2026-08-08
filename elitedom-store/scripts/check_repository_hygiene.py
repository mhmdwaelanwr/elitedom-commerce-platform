#!/usr/bin/env python3
"""Validate canonical repository structure and reject generated/retired files."""

from __future__ import annotations

import subprocess
from pathlib import Path, PurePosixPath

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

ALLOWED_ROOT_DIRECTORIES = {
    ".github",
    "docs",
    "elitedom-store",
}

ALLOWED_ROOT_FILES = {
    ".editorconfig",
    ".gitattributes",
    ".gitignore",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SECURITY.md",
}

CANONICAL_PATHS = (
    ".gitattributes",
    ".github/CODEOWNERS",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/dependabot.yml",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
    "LICENSE",
    "NOTICE",
    "docs/README.md",
    "docs/governance/DOCUMENTATION_STANDARD.md",
    "docs/product/foundation/PROJECT_FOUNDATION.md",
    "docs/product/requirements/BUSINESS_REQUIREMENTS.md",
    "docs/architecture/overview/SOLUTION_ARCHITECTURE.md",
    "docs/architecture/decisions/ADR-001-Odoo.md",
    "docs/architecture/decisions/ADR-011-Paymob.md",
    "docs/architecture/integrations/PAYMOB.md",
    "docs/engineering/development/DEVELOPMENT_GUIDELINES.md",
    "docs/operations/runbooks/RUNBOOK.md",
    "docs/delivery/releases/STAGE_0_BASELINE.md",
    "docs/delivery/releases/STAGE_1_CLEANUP_REPORT.md",
    "docs/delivery/releases/STAGE_10_UAT_GO_LIVE.md",
    "elitedom-store/backend/README.md",
    "elitedom-store/backend/app/main.py",
    "elitedom-store/frontend/package.json",
    "elitedom-store/frontend/vite.config.ts",
    "elitedom-store/infrastructure/README.md",
    "elitedom-store/infrastructure/docker-compose.yml",
    "elitedom-store/odoo/README.md",
    "elitedom-store/odoo/addons/elitedom_connector/__manifest__.py",
    "elitedom-store/scripts/README.md",
    "elitedom-store/scripts/validate_documentation.py",
)

RETIRED_PREFIXES = (
    "nextjs-ecommerce-template-main/",
)

LEGACY_DOCUMENTATION_PREFIXES = tuple(f"{index:02d}_" for index in range(19))

RETIRED_EXACT_FILES = {
    "DOCUMENTATION_INDEX.md",
    "elitedom-store/backend/package-lock.json",
    "elitedom-store/docs/STAGE_0_BASELINE.md",
    "elitedom-store/docs/STAGE_1_CLEANUP_REPORT.md",
    "elitedom-store/frontend/CLAUDE.md",
    "elitedom-store/frontend/pnpm-lock.yaml",
    "elitedom-store/frontend/yarn.lock",
    "elitedom-store/frontend/public/file.svg",
    "elitedom-store/frontend/public/globe.svg",
    "elitedom-store/frontend/public/next.svg",
    "elitedom-store/frontend/public/vercel.svg",
    "elitedom-store/frontend/public/window.svg",
}

GENERATED_PARTS = {
    ".cache",
    ".fleet",
    ".idea",
    ".mypy_cache",
    ".next",
    ".npm",
    ".pytest_cache",
    ".ruff_cache",
    ".turbo",
    ".vite",
    ".vscode",
    "__MACOSX",
    "__pycache__",
    "dist",
    "htmlcov",
    "node_modules",
}

JUNK_SUFFIXES = {".orig", ".rej", ".temp", ".tmp"}
CANONICAL_NPM_LOCK = "elitedom-store/frontend/package-lock.json"


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=REPOSITORY_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(path for path in result.stdout.split("\0") if path)


def find_violations(paths: list[str]) -> list[str]:
    violations: list[str] = []

    for raw_path in paths:
        path = PurePosixPath(raw_path)
        name = path.name
        top_level = path.parts[0]

        if len(path.parts) == 1:
            if raw_path not in ALLOWED_ROOT_FILES:
                violations.append(f"unexpected repository-root file: {raw_path}")
        elif top_level not in ALLOWED_ROOT_DIRECTORIES:
            violations.append(f"unexpected repository-root directory: {top_level}/")

        if top_level.startswith(LEGACY_DOCUMENTATION_PREFIXES):
            violations.append(
                f"legacy numbered documentation root is tracked: {top_level}/; use docs/<domain>/"
            )

        if raw_path in RETIRED_EXACT_FILES:
            violations.append(f"retired file is tracked: {raw_path}")

        if any(raw_path.startswith(prefix) for prefix in RETIRED_PREFIXES):
            violations.append(f"retired reference source is tracked: {raw_path}")

        if GENERATED_PARTS.intersection(path.parts):
            violations.append(f"generated/editor directory content is tracked: {raw_path}")

        if name == ".DS_Store" or name == "Thumbs.db":
            violations.append(f"operating-system artifact is tracked: {raw_path}")

        if name.startswith("celerybeat-schedule"):
            violations.append(f"Celery runtime state is tracked: {raw_path}")

        if path.suffix in {".pyc", ".pyo"}:
            violations.append(f"compiled Python artifact is tracked: {raw_path}")

        if path.suffix in JUNK_SUFFIXES:
            violations.append(f"temporary/conflict artifact is tracked: {raw_path}")

        if name in {".coverage", "coverage.xml"} or name.startswith(".coverage."):
            violations.append(f"coverage output is tracked: {raw_path}")

        if name.endswith(".tsbuildinfo"):
            violations.append(f"TypeScript build cache is tracked: {raw_path}")

        if name.endswith(".log"):
            violations.append(f"runtime log is tracked: {raw_path}")

        if name == "package-lock.json" and raw_path != CANONICAL_NPM_LOCK:
            violations.append(
                f"unexpected npm lockfile is tracked: {raw_path}; frontend is the canonical npm package"
            )

        if raw_path.startswith("elitedom-store/backend/media/"):
            violations.append(f"local product media is tracked: {raw_path}")

        if name == ".env" or (
            name.startswith(".env.") and not name.endswith(".example")
        ):
            violations.append(f"environment or secret file is tracked: {raw_path}")

        if path.parent == PurePosixPath("docs") and name.startswith("STAGE_"):
            violations.append(
                f"release report is stored at docs root: {raw_path}; use docs/delivery/releases/"
            )

    for required_path in CANONICAL_PATHS:
        if not (REPOSITORY_ROOT / required_path).is_file():
            violations.append(f"canonical project path is missing: {required_path}")

    return violations


def main() -> int:
    try:
        paths = tracked_files()
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"Repository hygiene check could not inspect Git: {exc}")
        return 2

    violations = find_violations(paths)
    if violations:
        print("Repository hygiene violations:")
        for violation in violations:
            print(f"- {violation}")
        return 1

    print(f"Repository hygiene passed for {len(paths)} tracked files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

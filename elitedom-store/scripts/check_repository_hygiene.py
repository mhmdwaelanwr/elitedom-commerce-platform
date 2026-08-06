#!/usr/bin/env python3
"""Validate that generated files and retired sources are not tracked."""

from __future__ import annotations

import subprocess
from pathlib import Path, PurePosixPath

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

CANONICAL_PATHS = (
    "elitedom-store/backend/app/main.py",
    "elitedom-store/frontend/package.json",
    "elitedom-store/infrastructure/docker-compose.yml",
    "elitedom-store/odoo/addons/elitedom_connector/__manifest__.py",
)

RETIRED_PREFIXES = (
    "nextjs-ecommerce-template-main/",
)

RETIRED_EXACT_FILES = {
    "elitedom-store/frontend/public/file.svg",
    "elitedom-store/frontend/public/globe.svg",
    "elitedom-store/frontend/public/next.svg",
    "elitedom-store/frontend/public/vercel.svg",
    "elitedom-store/frontend/public/window.svg",
}

GENERATED_PARTS = {
    ".mypy_cache",
    ".next",
    ".npm",
    ".pytest_cache",
    ".ruff_cache",
    ".turbo",
    "__pycache__",
    "node_modules",
}


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

        if raw_path in RETIRED_EXACT_FILES:
            violations.append(f"retired starter asset is tracked: {raw_path}")

        if any(raw_path.startswith(prefix) for prefix in RETIRED_PREFIXES):
            violations.append(f"retired reference source is tracked: {raw_path}")

        if GENERATED_PARTS.intersection(path.parts):
            violations.append(f"generated directory content is tracked: {raw_path}")

        if name == ".DS_Store" or name == "Thumbs.db":
            violations.append(f"operating-system artifact is tracked: {raw_path}")

        if name.startswith("celerybeat-schedule"):
            violations.append(f"Celery runtime state is tracked: {raw_path}")

        if path.suffix in {".pyc", ".pyo"}:
            violations.append(f"compiled Python artifact is tracked: {raw_path}")

        if raw_path.startswith("elitedom-store/backend/media/"):
            violations.append(f"local product media is tracked: {raw_path}")

        if name == ".env" or (
            name.startswith(".env.") and not name.endswith(".example")
        ):
            violations.append(f"environment or secret file is tracked: {raw_path}")

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

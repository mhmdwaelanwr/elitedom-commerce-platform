#!/usr/bin/env python3
"""Build a P23 release-candidate manifest only from passing isolated CI evidence."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

_FULL_SHA = re.compile(r"^[0-9a-fA-F]{40}$")


def load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read valid JSON from {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return payload


def playwright_summary(path: Path, label: str) -> dict[str, int]:
    payload = load_json(path)
    stats = payload.get("stats")
    if not isinstance(stats, dict):
        raise ValueError(f"{label} report is missing Playwright stats")
    summary = {
        "expected": int(stats.get("expected", 0)),
        "skipped": int(stats.get("skipped", 0)),
        "unexpected": int(stats.get("unexpected", 0)),
        "flaky": int(stats.get("flaky", 0)),
    }
    if summary["expected"] < 1:
        raise ValueError(f"{label} did not record any passing expected tests")
    if summary["unexpected"] != 0:
        raise ValueError(f"{label} contains {summary['unexpected']} unexpected failures")
    if summary["flaky"] != 0:
        raise ValueError(f"{label} contains flaky tests and cannot certify a release candidate")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-sha", required=True)
    parser.add_argument("--candidate-ref", required=True)
    parser.add_argument("--event", required=True)
    parser.add_argument("--liveness", required=True, type=Path)
    parser.add_argument("--readiness", required=True, type=Path)
    parser.add_argument("--integration-report", required=True, type=Path)
    parser.add_argument("--uat-report", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    candidate_sha = args.candidate_sha.strip().lower()
    candidate_ref = args.candidate_ref.strip()
    if not _FULL_SHA.fullmatch(candidate_sha):
        print("candidate_sha must be a full 40-character hexadecimal Git SHA", file=sys.stderr)
        return 2
    if not candidate_ref:
        print("candidate_ref must not be empty", file=sys.stderr)
        return 2

    try:
        liveness = load_json(args.liveness)
        readiness = load_json(args.readiness)
        integration = playwright_summary(args.integration_report, "P22 real-stack integration")
        uat = playwright_summary(args.uat_report, "P23 UAT")

        if liveness.get("status") != "healthy":
            raise ValueError("FastAPI liveness is not healthy")
        deployed_version = str(liveness.get("version") or "").strip().lower()
        if deployed_version != candidate_sha:
            raise ValueError(
                f"FastAPI release provenance mismatch: expected {candidate_sha}, got {deployed_version or '<empty>'}"
            )
        if readiness.get("ready") is not True:
            raise ValueError("FastAPI readiness is not ready")
        dependencies = readiness.get("dependencies")
        if not isinstance(dependencies, dict) or any(value != "ready" for value in dependencies.values()):
            raise ValueError("One or more readiness dependencies are not ready")
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    manifest = {
        "schema_version": 1,
        "phase": "P23",
        "status": "release-candidate-qualified",
        "candidate_sha": candidate_sha,
        "candidate_ref": candidate_ref,
        "source_event": args.event,
        "qualified_at_utc": datetime.now(UTC).isoformat(),
        "environment": {
            "kind": "isolated-ci-full-stack",
            "production_deployment": False,
            "components": [
                "React/Vite storefront",
                "FastAPI",
                "PostgreSQL",
                "Redis",
                "Celery worker/beat",
                "Odoo 17 with elitedom_connector",
            ],
            "payment_boundary": "Paymob disabled; P22 financial browser journey uses COD only",
        },
        "provenance": {
            "health_version": liveness.get("version"),
            "health_status": liveness.get("status"),
            "readiness": readiness.get("ready"),
            "dependencies": dependencies,
        },
        "gates": {
            "p22_real_stack_integration": integration,
            "p23_uat": uat,
        },
        "uat_scope": {
            "viewports": ["360x800", "390x844", "430x932", "1024x768"],
            "locales": ["ar", "en"],
            "directions": ["rtl", "ltr"],
            "themes": ["dark", "light"],
            "public_surfaces": ["home", "catalog", "product detail", "business"],
            "authenticated_roles": ["customer", "verified B2B client", "system admin with MFA/RBAC"],
            "acceptance_checks": [
                "no horizontal overflow",
                "no browser page errors",
                "no HTTP 5xx responses",
                "theme persistence",
                "locale/direction persistence",
                "captured full-page evidence",
            ],
        },
        "promotion_boundary": {
            "qualified_for": "staging deployment and human UAT continuation",
            "does_not_claim": "live staging or production deployment success",
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Materialize the validated enterprise documentation bundle on this feature branch."""

from __future__ import annotations

import base64
import json
import lzma
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "mhmdwaelanwr/elitedom-erp-architecture-main")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
BLOB_SHAS = (
    "8d59b55561d698c58bf77531629af32e85f4e5d1",
    "164408dc1baff3e666732d1cc81d38227823d619",
    "cbfbb9175622fca6229d61b73bad36be7e54467a",
    "74d92d53b227273ba54987955236ae5a09f1b2f9",
    "f5c2fbf2cd54f9fb16d34efb29cf771bda660c96",
    "90ac7dbb56ce40e4acf7514c97cc2fa05748eb9c",
)


def fetch_text_blob(sha: str) -> str:
    request = Request(
        f"https://api.github.com/repos/{REPOSITORY}/git/blobs/{sha}",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            **({"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}),
        },
    )
    with urlopen(request, timeout=30) as response:
        payload = json.load(response)
    return base64.b64decode(payload["content"]).decode("utf-8").strip()


encoded_bundle = "".join(fetch_text_blob(sha) for sha in BLOB_SHAS)
compressed = base64.b64decode(encoded_bundle, validate=True)
files: dict[str, str] = json.loads(lzma.decompress(compressed).decode("utf-8"))

written = 0
for relative_path, content in sorted(files.items()):
    # GitHub's Actions token is intentionally not granted workflow-management
    # permission. Workflow changes are applied separately by the GitHub connector.
    if relative_path.startswith(".github/workflows/"):
        continue
    destination = ROOT / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding="utf-8")
    written += 1

# Stage 0 and 1 belong to immutable delivery history alongside Stages 2-10.
for relative_path in (
    "elitedom-store/docs/STAGE_0_BASELINE.md",
    "elitedom-store/docs/STAGE_1_CLEANUP_REPORT.md",
):
    legacy = ROOT / relative_path
    if legacy.exists():
        legacy.unlink()

# The script is bootstrap plumbing; the workflow is removed separately by the
# GitHub connector after this validated commit reaches the feature branch.
bootstrap_script = ROOT / ".tmp/apply_docs_bundle.py"
if bootstrap_script.exists():
    bootstrap_script.unlink()

temporary_root = ROOT / ".tmp"
if temporary_root.exists() and not any(temporary_root.iterdir()):
    temporary_root.rmdir()

print(f"Applied {written} generated repository files; workflow files deferred.")

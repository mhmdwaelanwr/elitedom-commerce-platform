#!/usr/bin/env python3
"""Verify that a public Elitedom API is serving the expected immutable release ref."""

from __future__ import annotations

import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

from live_smoke import fetch, validate_origin

_RELEASE_REF = re.compile(r"^[0-9a-fA-F]{7,64}$")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True, help="Public HTTPS API origin")
    parser.add_argument(
        "--release-ref",
        required=True,
        help="Expected deployed Git commit SHA (short or full hexadecimal SHA)",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    expected = args.release_ref.strip()
    if not _RELEASE_REF.fullmatch(expected):
        print(
            json.dumps(
                {
                    "ok": False,
                    "configuration_error": "release_ref must be a 7-64 character hexadecimal Git commit SHA",
                },
                indent=2,
            )
        )
        return 2

    try:
        api_origin = validate_origin(args.api_url, allow_local=False)
        status, _headers, body = fetch(
            urljoin(api_origin, "health/live"),
            timeout=args.timeout,
            allow_local=False,
        )
        payload = json.loads(body.decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 1

    actual = str(payload.get("version") or "").strip()
    healthy = status == 200 and payload.get("status") == "healthy"
    matches = actual.casefold() == expected.casefold()
    report = {
        "ok": healthy and matches,
        "api_origin": api_origin,
        "expected_release_ref": expected,
        "deployed_release_ref": actual,
        "status_code": status,
        "health_status": payload.get("status"),
    }
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

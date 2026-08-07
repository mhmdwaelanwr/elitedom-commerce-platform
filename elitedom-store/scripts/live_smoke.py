#!/usr/bin/env python3
"""External launch smoke checks for a deployed Elitedom storefront and API.

The default mode accepts only public HTTPS origins. This makes the script safe
for use from a manually dispatched GitHub Actions workflow without turning the
runner into a private-network request proxy. Local HTTP is available only with
--allow-local for developer-operated smoke tests.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import socket
import sys
from dataclasses import asdict, dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    status_code: int | None = None


class _NoRedirectHandler(HTTPRedirectHandler):
    """Fail closed on redirects so a public URL cannot bounce to a private host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001,ANN201
        return None


_NO_REDIRECT_OPENER = build_opener(_NoRedirectHandler())


def _is_local_hostname(hostname: str) -> bool:
    return hostname.casefold() in {"localhost", "127.0.0.1", "::1"}


def _is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _assert_allowed_network_target(
    hostname: str,
    port: int,
    *,
    allow_local: bool,
) -> None:
    local = _is_local_hostname(hostname)
    if allow_local and local:
        return
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(hostname, port)}
    except socket.gaierror as exc:
        raise ValueError(f"Unable to resolve {hostname!r}: {exc}") from exc
    if not addresses or not all(_is_public_ip(address) for address in addresses):
        raise ValueError(
            f"Origin {hostname!r} resolves to a non-public address and is blocked."
        )


def _validate_request_target(url: str, *, allow_local: bool) -> None:
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc or not parsed.hostname:
        raise ValueError(f"Invalid request target: {url!r}")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Request targets must not contain embedded credentials.")
    local = _is_local_hostname(parsed.hostname)
    if parsed.scheme != "https":
        if not (allow_local and local and parsed.scheme == "http"):
            raise ValueError("Smoke-test request targets must use HTTPS.")
    _assert_allowed_network_target(
        parsed.hostname,
        parsed.port or (443 if parsed.scheme == "https" else 80),
        allow_local=allow_local,
    )


def validate_origin(value: str, *, allow_local: bool) -> str:
    parsed = urlsplit(value.strip())
    if not parsed.scheme or not parsed.netloc or not parsed.hostname:
        raise ValueError(f"Invalid origin: {value!r}")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Origins must not contain embedded credentials.")
    if parsed.query or parsed.fragment:
        raise ValueError("Origins must not contain query strings or fragments.")
    if parsed.path not in {"", "/"}:
        raise ValueError("Origins must not contain an application path.")

    normalized = f"{parsed.scheme}://{parsed.netloc}/"
    _validate_request_target(normalized, allow_local=allow_local)
    return normalized


def fetch(
    url: str,
    *,
    timeout: float,
    allow_local: bool,
) -> tuple[int, dict[str, str], bytes]:
    # Resolve and validate immediately before every network request. Redirects
    # are disabled below, so no unvalidated destination can be followed.
    _validate_request_target(url, allow_local=allow_local)
    request = Request(
        url,
        headers={
            "Accept": "*/*",
            "User-Agent": "Elitedom-Launch-Smoke/1.0",
        },
        method="GET",
    )
    with _NO_REDIRECT_OPENER.open(request, timeout=timeout) as response:
        return (
            int(response.status),
            {key.casefold(): value for key, value in response.headers.items()},
            response.read(1_000_000),
        )


def run_check(name: str, callback) -> CheckResult:
    try:
        status_code, detail = callback()
        return CheckResult(name=name, ok=True, detail=detail, status_code=status_code)
    except HTTPError as exc:
        return CheckResult(
            name=name,
            ok=False,
            detail=f"HTTP {exc.code}: {exc.reason}",
            status_code=exc.code,
        )
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return CheckResult(name=name, ok=False, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive CLI boundary
        return CheckResult(name=name, ok=False, detail=f"Unexpected error: {exc}")


def expect_page(
    url: str,
    *,
    timeout: float,
    allow_local: bool,
    contains: str | None = None,
):
    def check() -> tuple[int, str]:
        status, _headers, body = fetch(
            url,
            timeout=timeout,
            allow_local=allow_local,
        )
        if status != 200:
            raise ValueError(f"Expected HTTP 200, received {status}.")
        text = body.decode("utf-8", errors="replace")
        if contains and contains.casefold() not in text.casefold():
            raise ValueError(f"Response does not contain required marker {contains!r}.")
        return status, f"HTTP {status}; {len(body)} bytes sampled"

    return check


def expect_json_health(
    url: str,
    *,
    timeout: float,
    allow_local: bool,
    readiness: bool,
):
    def check() -> tuple[int, str]:
        status, headers, body = fetch(
            url,
            timeout=timeout,
            allow_local=allow_local,
        )
        payload: dict[str, Any] = json.loads(body.decode("utf-8"))
        if status != 200:
            raise ValueError(f"Expected HTTP 200, received {status}.")
        if readiness:
            if payload.get("ready") is not True or payload.get("status") != "ready":
                raise ValueError(f"API is not ready: {payload.get('status')!r}.")
        elif payload.get("status") != "healthy":
            raise ValueError(f"API liveness is not healthy: {payload.get('status')!r}.")

        required_headers = {
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
            "referrer-policy": "no-referrer",
        }
        missing = [
            key
            for key, expected in required_headers.items()
            if headers.get(key) != expected
        ]
        if missing:
            raise ValueError(
                "Missing or unexpected security headers: " + ", ".join(missing)
            )
        return status, f"HTTP {status}; status={payload.get('status')}"

    return check


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-url", required=True, help="Public storefront origin")
    parser.add_argument(
        "--api-url",
        required=True,
        help="Public API origin, without /api/v1",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument(
        "--allow-local",
        action="store_true",
        help="Allow localhost HTTP for an explicitly developer-operated smoke test.",
    )
    args = parser.parse_args()

    try:
        site = validate_origin(args.site_url, allow_local=args.allow_local)
        api = validate_origin(args.api_url, allow_local=args.allow_local)
    except ValueError as exc:
        print(json.dumps({"ok": False, "configuration_error": str(exc)}, indent=2))
        return 2

    checks = [
        run_check(
            "storefront",
            expect_page(
                site,
                timeout=args.timeout,
                allow_local=args.allow_local,
            ),
        ),
        run_check(
            "robots",
            expect_page(
                urljoin(site, "robots.txt"),
                timeout=args.timeout,
                allow_local=args.allow_local,
                contains="Sitemap:",
            ),
        ),
        run_check(
            "sitemap",
            expect_page(
                urljoin(site, "sitemap.xml"),
                timeout=args.timeout,
                allow_local=args.allow_local,
                contains="<urlset",
            ),
        ),
        run_check(
            "api_liveness",
            expect_json_health(
                urljoin(api, "health/live"),
                timeout=args.timeout,
                allow_local=args.allow_local,
                readiness=False,
            ),
        ),
        run_check(
            "api_readiness",
            expect_json_health(
                urljoin(api, "health/ready"),
                timeout=args.timeout,
                allow_local=args.allow_local,
                readiness=True,
            ),
        ),
    ]
    ok = all(item.ok for item in checks)
    report = {
        "ok": ok,
        "site_origin": site,
        "api_origin": api,
        "checks": [asdict(item) for item in checks],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

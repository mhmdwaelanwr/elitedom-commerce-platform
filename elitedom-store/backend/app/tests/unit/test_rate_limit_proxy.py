"""Rate limiting must not trust a spoofed forwarding header from clients."""

from starlette.requests import Request

from app.middleware import rate_limit


def _request(*, peer_ip: str, forwarded_for: str | None = None) -> Request:
    headers = [] if forwarded_for is None else [(b"x-forwarded-for", forwarded_for.encode())]
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/products",
            "headers": headers,
            "client": (peer_ip, 52345),
            "scheme": "http",
            "server": ("testserver", 80),
        }
    )


def test_untrusted_client_cannot_spoof_forwarded_for(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "10.0.0.1")
    request = _request(peer_ip="198.51.100.4", forwarded_for="203.0.113.8")

    assert rate_limit._client_ip(request) == "198.51.100.4"


def test_configured_proxy_forwards_client_address(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "10.0.0.1")
    request = _request(peer_ip="10.0.0.1", forwarded_for="203.0.113.8, 10.0.0.2")

    assert rate_limit._client_ip(request) == "203.0.113.8"

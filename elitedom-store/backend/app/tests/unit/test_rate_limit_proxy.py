"""Rate limiting must not trust spoofed forwarding headers from clients."""

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


def test_configured_proxy_uses_address_it_observed(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "10.0.0.1")
    request = _request(
        peer_ip="10.0.0.1",
        forwarded_for="198.51.100.99, 203.0.113.8",
    )

    # 198.51.100.99 is attacker-supplied. Nginx appended the direct client
    # address (203.0.113.8), which is the only hop the trusted proxy observed.
    assert rate_limit._client_ip(request) == "203.0.113.8"


def test_distinct_clients_behind_proxy_keep_distinct_identities(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "10.0.0.1")
    first = _request(peer_ip="10.0.0.1", forwarded_for="203.0.113.8")
    second = _request(peer_ip="10.0.0.1", forwarded_for="203.0.113.9")

    assert rate_limit._client_ip(first) != rate_limit._client_ip(second)

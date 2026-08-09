"""Regression coverage for the remaining Paymob/proxy security follow-up."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from starlette.requests import Request

from app.integrations.paymob.webhooks import _binding_error, _find_attempt_and_order
from app.middleware import rate_limit


def test_paymob_unsigned_intention_cannot_rebind_signed_provider_order() -> None:
    attempt = SimpleNamespace(
        provider_order_id="555",
        provider_transaction_id=None,
        provider_intention_id="pi-good",
        provider_reference="SO-SEC-001",
    )
    order = SimpleNamespace(id=77, name="SO-SEC-001")
    transaction = {
        "id": 987654,
        "order": {"id": 555},
        "payment_key_claims": {
            "intention_id": "pi-attacker-controlled",
            "extra": {"order_id": "77", "order_number": "SO-SEC-001"},
        },
    }

    assert _binding_error(transaction, attempt, order) == "intention_mismatch"


def test_paymob_unsigned_local_order_cannot_rebind_signed_provider_order() -> None:
    attempt = SimpleNamespace(
        provider_order_id="555",
        provider_transaction_id=None,
        provider_intention_id="pi-good",
        provider_reference="SO-SEC-001",
    )
    order = SimpleNamespace(id=77, name="SO-SEC-001")
    transaction = {
        "id": 987654,
        "order": {"id": 555},
        "payment_key_claims": {
            "intention_id": "pi-good",
            "extra": {"order_id": "999", "order_number": "SO-SEC-001"},
        },
    }

    assert _binding_error(transaction, attempt, order) == "local_order_mismatch"


@pytest.mark.asyncio
async def test_paymob_conflicting_signed_identifiers_cannot_choose_an_attempt() -> None:
    transaction_attempt = SimpleNamespace(id=101)
    provider_order_attempt = SimpleNamespace(id=202)
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=[transaction_attempt, provider_order_attempt])
    )

    attempt, order = await _find_attempt_and_order(
        db,
        {"id": "tx-101", "order": {"id": "po-202"}},
    )

    assert attempt is None
    assert order is None
    assert db.scalar.await_count == 2


def _request(peer: str, forwarded: str | None = None) -> Request:
    headers = []
    if forwarded is not None:
        headers.append((b"x-forwarded-for", forwarded.encode("ascii")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "scheme": "https",
            "path": "/api/v1/auth/login",
            "raw_path": b"/api/v1/auth/login",
            "query_string": b"",
            "headers": headers,
            "client": (peer, 443),
            "server": ("api.elitedom.store", 443),
        }
    )


def test_rate_limit_uses_client_adjacent_to_pinned_proxy(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "172.28.0.10")
    request = _request("172.28.0.10", "198.51.100.200, 203.0.113.5")
    assert rate_limit._client_ip(request) == "203.0.113.5"


def test_rate_limit_ignores_forwarded_header_from_untrusted_peer(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "172.28.0.10")
    request = _request("203.0.113.99", "198.51.100.200")
    assert rate_limit._client_ip(request) == "203.0.113.99"


def test_rate_limit_rejects_invalid_forwarded_client_ip(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "172.28.0.10")
    request = _request("172.28.0.10", "198.51.100.200, not-an-ip")
    assert rate_limit._client_ip(request) == "172.28.0.10"

"""Regression coverage for the August 2026 security review findings."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from app.integrations.paymob.webhooks import _binding_error
from app.middleware import rate_limit
from app.models import Partner
from app.modules.auth.models import AuthSession
from app.shared.security import create_access_token, create_refresh_token


@pytest.mark.asyncio
async def test_sidless_access_token_is_rejected_by_optional_cart_auth(client) -> None:
    token = create_access_token(
        {
            "sub": "123",
            "email": "legacy@example.test",
            "role": "customer",
        }
    )

    response = await client.get(
        "/api/v1/orders/cart?session_id=guest-security-regression",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_revoked_session_is_rejected_by_optional_cart_auth(client, db_session) -> None:
    partner = Partner(
        name="Revoked Session Customer",
        email="revoked-session@example.test",
        phone="01012340000",
        role="customer",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    session = AuthSession(
        id="22222222-3333-4444-5555-666666666666",
        partner_id=partner.id,
        refresh_token_hash="a" * 64,
        auth_method="password",
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=datetime.now(UTC),
        revoke_reason="security_test",
    )
    db_session.add(session)
    await db_session.flush()
    token = create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
            "sid": session.id,
        }
    )

    response = await client.get(
        "/api/v1/orders/cart?session_id=guest-security-regression",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_sidless_legacy_refresh_token_cannot_recreate_a_session(client, db_session) -> None:
    partner = Partner(
        name="Legacy Refresh Customer",
        email="legacy-refresh@example.test",
        phone="01012340001",
        role="customer",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    token = create_refresh_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
        }
    )

    response = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": token},
    )

    assert response.status_code == 401


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
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "172.30.0.10")

    request = _request(
        "172.30.0.10",
        "198.51.100.200, 203.0.113.5",
    )

    assert rate_limit._client_ip(request) == "203.0.113.5"


def test_rate_limit_ignores_forwarded_header_from_untrusted_peer(monkeypatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_ips", "172.30.0.10")

    request = _request("203.0.113.99", "198.51.100.200")

    assert rate_limit._client_ip(request) == "203.0.113.99"

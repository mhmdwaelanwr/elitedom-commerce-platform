"""Regression coverage for the August 2026 authentication security findings."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Partner
from app.shared.security import create_access_token, create_refresh_token


async def _register_customer(client: AsyncClient, db: AsyncSession, email: str) -> Partner:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Security Regression Customer",
            "email": email,
            "mobile": "01012345678",
            "password": "SecurityRegression123!",
        },
    )
    assert response.status_code == 201
    partner = await db.scalar(select(Partner).where(Partner.email == email))
    assert partner is not None
    return partner


@pytest.mark.asyncio
async def test_sidless_access_token_is_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    partner = await _register_customer(client, db_session, "sidless-access@example.com")
    legacy_access = create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
        }
    )

    response = await client.get(
        "/api/v1/customers/me",
        headers={"Authorization": f"Bearer {legacy_access}"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_revoked_access_token_is_rejected_by_optional_cart_auth(
    client: AsyncClient,
) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Revoked Cart Customer",
            "email": "revoked-cart@example.com",
            "mobile": "01112345678",
            "password": "RevokedCart123!",
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "revoked-cart@example.com",
            "password": "RevokedCart123!",
        },
    )
    assert login.status_code == 200
    access_token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    logout = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204

    response = await client.get(
        "/api/v1/orders/cart?session_id=must-not-fall-back-to-guest",
        headers=headers,
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_sidless_refresh_token_is_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    partner = await _register_customer(client, db_session, "sidless-refresh@example.com")
    legacy_refresh = create_refresh_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
        }
    )
    client.cookies.set(
        "refresh_token",
        legacy_refresh,
        path="/api/v1/auth",
    )

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


def test_production_configuration_requires_trusted_proxy_identity() -> None:
    with pytest.raises(ValueError, match="TRUSTED_PROXY_IPS"):
        Settings(
            environment="production",
            debug=False,
            allowed_hosts="api.example.test",
            cors_origins="https://store.example.test",
            staff_mfa_required=True,
            rate_limit_backend="redis",
            trusted_proxy_ips="",
            metrics_enabled=False,
            secret_key="prod-secret-key-that-is-long-enough-and-random-001",
            jwt_secret_key="prod-jwt-key-that-is-long-enough-and-random-002",
            postgres_password="prod-postgres-password-that-is-long-enough-003",
            redis_password="prod-redis-password-that-is-long-enough-004",
        )

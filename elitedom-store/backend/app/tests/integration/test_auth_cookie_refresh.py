"""Refresh tokens must remain in HttpOnly cookies, never JSON payloads."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_and_refresh_keep_refresh_token_out_of_response_json(
    client: AsyncClient,
) -> None:
    registration = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Cookie Security Customer",
            "email": "cookie-security@example.com",
            "mobile": "01012345678",
            "password": "CookieSecurity123!",
        },
    )
    assert registration.status_code == 201

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "cookie-security@example.com", "password": "CookieSecurity123!"},
    )
    assert login.status_code == 200
    assert "refresh_token" not in login.json()
    cookie_header = login.headers["set-cookie"].lower()
    assert "httponly" in cookie_header
    assert "path=/api/v1/auth" in cookie_header

    refresh = await client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 200
    assert "access_token" in refresh.json()
    assert "refresh_token" not in refresh.json()

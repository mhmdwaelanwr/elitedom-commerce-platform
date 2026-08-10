"""Regression coverage for browser CORS preflight and authentication quotas."""

import pytest

from app.middleware import rate_limit


@pytest.mark.asyncio
async def test_auth_cors_preflight_does_not_consume_login_rate_limit(client):
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }

    # More preflights than the ten-request login budget must remain harmless.
    for _ in range(15):
        response = await client.options("/api/v1/auth/login", headers=headers)
        assert response.status_code == 200
        assert "x-ratelimit-limit" not in response.headers

    # No application request quota was consumed by the OPTIONS requests.
    assert rate_limit._request_counts == {}

    # The real login request is still protected and receives rate-limit headers.
    login = await client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3000"},
        json={"email": "missing@example.com", "password": "NotARealPassword123!"},
    )
    assert login.status_code == 401
    assert login.headers["x-ratelimit-limit"] == "10"
    assert login.headers["x-ratelimit-remaining"] == "9"

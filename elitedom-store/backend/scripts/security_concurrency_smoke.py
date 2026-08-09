"""PostgreSQL-backed concurrency smoke tests for one-time auth credentials."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

from app.main import app


async def _post_with_cookie(path: str, refresh_token: str):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        return await client.post(
            path,
            headers={"Cookie": f"refresh_token={refresh_token}"},
        )


async def verify_refresh_rotation() -> None:
    suffix = uuid4().hex[:12]
    email = f"refresh-race-{suffix}@example.com"
    mobile = f"010{int(suffix[:7], 16) % 10_000_000:07d}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        registered = await client.post(
            "/api/v1/auth/register",
            json={
                "name": "Refresh Race",
                "email": email,
                "mobile": mobile,
                "password": "ConcurrencySmoke123!",
            },
        )
        assert registered.status_code == 201, registered.text
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "ConcurrencySmoke123!"},
        )
        assert login.status_code == 200, login.text
        refresh_token = login.cookies.get("refresh_token")
        assert refresh_token

    first, second = await asyncio.gather(
        _post_with_cookie("/api/v1/auth/refresh", refresh_token),
        _post_with_cookie("/api/v1/auth/refresh", refresh_token),
    )
    statuses = sorted((first.status_code, second.status_code))
    assert statuses == [200, 401], (
        "same refresh credential must be consumed exactly once; "
        f"got statuses {statuses}: {first.text!r}, {second.text!r}"
    )


async def verify_otp_single_use() -> None:
    suffix = uuid4().hex[:12]
    mobile = f"011{int(suffix[:7], 16) % 10_000_000:07d}"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        challenge = await client.post(
            "/api/v1/auth/otp/request",
            json={"mobile": mobile, "name": "OTP Race"},
        )
        assert challenge.status_code == 201, challenge.text
        payload = challenge.json()
        debug_code = payload.get("debug_code")
        assert debug_code, "development CI must expose the OTP debug code"
        verify_payload = {
            "challenge_id": payload["challenge_id"],
            "mobile": mobile,
            "code": debug_code,
        }

    async def verify_once():
        local_transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=local_transport,
            base_url="http://security-ci",
        ) as local_client:
            return await local_client.post("/api/v1/auth/otp/verify", json=verify_payload)

    first, second = await asyncio.gather(verify_once(), verify_once())
    statuses = sorted((first.status_code, second.status_code))
    assert statuses == [200, 401], (
        "one OTP challenge must issue tokens at most once; "
        f"got statuses {statuses}: {first.text!r}, {second.text!r}"
    )


async def main() -> None:
    await verify_refresh_rotation()
    await verify_otp_single_use()
    print("PostgreSQL auth concurrency smoke tests passed.")


if __name__ == "__main__":
    asyncio.run(main())

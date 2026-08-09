"""PostgreSQL-backed concurrency smoke tests for one-time auth credentials."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.shared.security import create_refresh_token


def _test_mobile(prefix: str, suffix: str) -> str:
    return f"{prefix}{int(suffix[:8], 16) % 100_000_000:08d}"


async def _post_with_cookie(path: str, refresh_token: str):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        return await client.post(
            path,
            headers={"Cookie": f"refresh_token={refresh_token}"},
        )


async def verify_legacy_refresh_rejected() -> None:
    suffix = uuid4().hex[:12]
    email = f"legacy-refresh-{suffix}@example.com"
    mobile = _test_mobile("012", suffix)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        registered = await client.post(
            "/api/v1/auth/register",
            json={
                "name": "Legacy Refresh",
                "email": email,
                "mobile": mobile,
                "password": "ConcurrencySmoke123!",
            },
        )
        assert registered.status_code == 201, registered.text
        user_id = registered.json()["user_id"]

    legacy_refresh = create_refresh_token(
        {"sub": str(user_id), "email": email, "role": "customer"}
    )
    response = await _post_with_cookie("/api/v1/auth/refresh", legacy_refresh)
    assert response.status_code == 401, (
        "sid-less refresh credentials must not recreate a tracked session; "
        f"got {response.status_code}: {response.text!r}"
    )


async def verify_refresh_rotation() -> None:
    suffix = uuid4().hex[:12]
    email = f"refresh-race-{suffix}@example.com"
    mobile = _test_mobile("010", suffix)
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


async def _new_otp_challenge(prefix: str, name: str) -> tuple[str, dict, str]:
    suffix = uuid4().hex[:12]
    mobile = _test_mobile(prefix, suffix)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://security-ci") as client:
        challenge = await client.post(
            "/api/v1/auth/otp/request",
            json={"mobile": mobile, "name": name},
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
    return mobile, verify_payload, debug_code


async def _verify_otp(payload: dict):
    local_transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=local_transport,
        base_url="http://security-ci",
    ) as local_client:
        return await local_client.post("/api/v1/auth/otp/verify", json=payload)


async def verify_otp_single_use() -> None:
    _, verify_payload, _ = await _new_otp_challenge("011", "OTP Race")

    first, second = await asyncio.gather(
        _verify_otp(verify_payload),
        _verify_otp(verify_payload),
    )
    statuses = sorted((first.status_code, second.status_code))
    assert statuses == [200, 401], (
        "one OTP challenge must issue tokens at most once; "
        f"got statuses {statuses}: {first.text!r}, {second.text!r}"
    )


async def verify_otp_attempt_budget() -> None:
    _, verify_payload, debug_code = await _new_otp_challenge("015", "OTP Attempt Race")
    wrong_code = "000000" if debug_code != "000000" else "000001"
    wrong_payload = {**verify_payload, "code": wrong_code}

    failures = await asyncio.gather(*(_verify_otp(wrong_payload) for _ in range(5)))
    assert all(response.status_code == 401 for response in failures), [
        (response.status_code, response.text) for response in failures
    ]

    after_budget = await _verify_otp(verify_payload)
    assert after_budget.status_code == 401, (
        "five concurrent invalid guesses must consume the challenge budget; "
        f"got {after_budget.status_code}: {after_budget.text!r}"
    )


async def main() -> None:
    await verify_legacy_refresh_rejected()
    await verify_refresh_rotation()
    await verify_otp_single_use()
    await verify_otp_attempt_budget()
    print("PostgreSQL auth security smoke tests passed.")


if __name__ == "__main__":
    asyncio.run(main())

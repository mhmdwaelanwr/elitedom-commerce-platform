"""Integration coverage for phone OTP and revocable device sessions."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_phone_otp_creates_account_and_tracked_session(
    client: AsyncClient,
) -> None:
    challenge = await client.post(
        "/api/v1/auth/otp/request",
        json={"mobile": "01012345678", "name": "Phone Customer"},
    )
    assert challenge.status_code == 201
    challenge_payload = challenge.json()
    assert challenge_payload["delivery"] == "debug"
    assert len(challenge_payload["debug_code"]) == 6

    verification = await client.post(
        "/api/v1/auth/otp/verify",
        json={
            "challenge_id": challenge_payload["challenge_id"],
            "mobile": "+201012345678",
            "code": challenge_payload["debug_code"],
        },
    )
    assert verification.status_code == 200
    payload = verification.json()
    assert payload["name"] == "Phone Customer"
    assert payload["email"] == "phone.201012345678@phone.elitedom.local"
    assert "refresh_token" not in payload
    assert "httponly" in verification.headers["set-cookie"].lower()

    headers = {"Authorization": f"Bearer {payload['access_token']}"}
    sessions = await client.get("/api/v1/auth/sessions", headers=headers)
    assert sessions.status_code == 200
    session_items = sessions.json()["sessions"]
    assert len(session_items) == 1
    assert session_items[0]["id"] == payload["session_id"]
    assert session_items[0]["auth_method"] == "phone_otp"
    assert session_items[0]["current"] is True

    profile = await client.get("/api/v1/customers/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["phone"] == "+201012345678"
    assert profile.json()["email"] == "phone.201012345678@phone.elitedom.local"


@pytest.mark.asyncio
async def test_refresh_rotation_detects_replay_and_revokes_session(
    client: AsyncClient,
) -> None:
    registration = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Refresh Replay Customer",
            "email": "refresh-replay@example.com",
            "mobile": "01112345678",
            "password": "RefreshReplay123!",
        },
    )
    assert registration.status_code == 201

    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "refresh-replay@example.com",
            "password": "RefreshReplay123!",
        },
    )
    assert login.status_code == 200
    original_refresh = client.cookies.get("refresh_token")
    assert original_refresh

    rotation = await client.post("/api/v1/auth/refresh")
    assert rotation.status_code == 200
    rotated_payload = rotation.json()
    rotated_refresh = client.cookies.get("refresh_token")
    assert rotated_refresh and rotated_refresh != original_refresh

    client.cookies.clear()
    client.cookies.set("refresh_token", original_refresh, path="/api/v1/auth")
    replay = await client.post("/api/v1/auth/refresh")
    assert replay.status_code == 401

    rejected_access = await client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {rotated_payload['access_token']}"},
    )
    assert rejected_access.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_revokes_every_access_session(
    client: AsyncClient,
) -> None:
    registration = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Multi Device Customer",
            "email": "multi-device@example.com",
            "mobile": "01212345678",
            "password": "MultiDevice123!",
        },
    )
    assert registration.status_code == 201

    first_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "multi-device@example.com", "password": "MultiDevice123!"},
    )
    first_access = first_login.json()["access_token"]

    second_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "multi-device@example.com", "password": "MultiDevice123!"},
    )
    second_access = second_login.json()["access_token"]

    logout_all = await client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {second_access}"},
    )
    assert logout_all.status_code == 200
    assert logout_all.json()["revoked_sessions"] == 2

    for access_token in (first_access, second_access):
        rejected = await client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert rejected.status_code == 401

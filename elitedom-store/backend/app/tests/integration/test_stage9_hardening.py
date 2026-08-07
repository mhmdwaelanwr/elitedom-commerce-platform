"""Stage 9 coverage for staff MFA and production hardening controls."""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import Settings
from app.middleware import security_headers
from app.models import Partner
from app.modules.auth import mfa
from app.modules.auth.errors import InvalidMfaError
from app.modules.auth.mfa_service import AdminMfaService
from app.modules.auth.models import AdminMfaCredential, AuthSession
from app.shared import security as shared_security


async def _staff_with_session(db_session) -> tuple[Partner, AuthSession]:
    partner = Partner(
        name="Stage Nine Admin",
        email="stage9-admin@example.com",
        phone="01099990000",
        role="system_admin",
        company_type="person",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    session = AuthSession(
        id="11111111-2222-3333-4444-555555555555",
        partner_id=partner.id,
        refresh_token_hash="a" * 64,
        auth_method="password",
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    db_session.add(session)
    await db_session.flush()
    return partner, session


def _authorization(partner: Partner, session: AuthSession) -> dict[str, str]:
    token = shared_security.create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
            "sid": session.id,
        }
    )
    return {"Authorization": f"Bearer {token}"}


def test_totp_matches_rfc_vector_and_rejects_wrong_code():
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert mfa.verify_totp(secret, "287082", now=59)
    assert not mfa.verify_totp(secret, "287081", now=59)


def test_recovery_codes_are_hashed_and_single_use():
    code = "abcd1234-ef567890"
    encoded = mfa.encode_recovery_hashes([code])
    assert code not in encoded
    accepted, remaining = mfa.consume_recovery_code(encoded, code)
    assert accepted is True
    assert code not in remaining
    accepted_again, _ = mfa.consume_recovery_code(remaining, code)
    assert accepted_again is False


@pytest.mark.asyncio
async def test_staff_mfa_enrollment_encrypts_seed_and_verifies_recovery(
    db_session,
):
    partner, session = await _staff_with_session(db_session)
    service = AdminMfaService(db_session)

    enrollment = await service.begin_enrollment(
        partner_id=partner.id,
        session_id=session.id,
    )
    credential = await db_session.scalar(
        select(AdminMfaCredential).where(AdminMfaCredential.partner_id == partner.id)
    )
    assert credential is not None
    assert credential.secret_ciphertext != enrollment.secret
    assert enrollment.secret not in credential.secret_ciphertext

    counter = int(time.time()) // 30
    code = mfa._totp_at(enrollment.secret, counter)
    confirmed = await service.confirm_enrollment(
        partner_id=partner.id,
        session_id=session.id,
        code=code,
    )
    assert confirmed.status.enrolled is True
    assert confirmed.status.verified is True
    assert len(confirmed.recovery_codes) == 8
    assert all(
        recovery not in credential.recovery_code_hashes
        for recovery in confirmed.recovery_codes
    )

    session.mfa_verified_at = None
    recovery_code = confirmed.recovery_codes[0]
    verified = await service.verify(
        partner_id=partner.id,
        session_id=session.id,
        code=recovery_code,
    )
    assert verified.verified is True

    session.mfa_verified_at = None
    with pytest.raises(InvalidMfaError):
        await service.verify(
            partner_id=partner.id,
            session_id=session.id,
            code=recovery_code,
        )


@pytest.mark.asyncio
async def test_privileged_permission_requires_verified_mfa_when_policy_enabled(
    client,
    db_session,
    monkeypatch,
):
    partner, session = await _staff_with_session(db_session)
    monkeypatch.setattr(shared_security.settings, "staff_mfa_required", True)

    response = await client.get(
        "/api/v1/admin/access/me",
        headers=_authorization(partner, session),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "ELITE_1008"


def _production_settings(**overrides) -> Settings:
    values = {
        "environment": "production",
        "debug": False,
        "secret_key": "production-app-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "jwt_secret_key": "production-jwt-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "postgres_password": "production-postgres-cccccccccccccccccccccccccccccccc",
        "redis_password": "production-redis-dddddddddddddddddddddddddddddddd",
        "staff_mfa_required": True,
        "rate_limit_backend": "redis",
        "metrics_enabled": True,
        "metrics_bearer_token": "production-metrics-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "allowed_hosts": "api.elitedom.store",
        "cors_origins": "https://elitedom.store",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def test_production_configuration_requires_mfa_redis_and_metrics_secret():
    assert _production_settings().staff_mfa_required is True

    with pytest.raises(ValueError, match="STAFF_MFA_REQUIRED"):
        _production_settings(staff_mfa_required=False)
    with pytest.raises(ValueError, match="RATE_LIMIT_BACKEND"):
        _production_settings(rate_limit_backend="memory")
    with pytest.raises(ValueError, match="METRICS_BEARER_TOKEN"):
        _production_settings(metrics_bearer_token="")


def test_s3_media_configuration_requires_bucket_and_https_cdn():
    with pytest.raises(ValueError, match="S3_BUCKET"):
        _production_settings(
            media_storage_provider="s3",
            media_cdn_base_url="https://media.elitedom.store",
        )
    with pytest.raises(ValueError, match="MEDIA_CDN_BASE_URL"):
        _production_settings(
            media_storage_provider="s3",
            s3_bucket="elitedom-media",
            media_cdn_base_url="http://media.elitedom.store",
        )


@pytest.mark.asyncio
async def test_mfa_enrollment_responses_are_not_cacheable(client, db_session):
    partner, session = await _staff_with_session(db_session)
    response = await client.post(
        "/api/v1/auth/mfa/enroll",
        headers=_authorization(partner, session),
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert "secret" in response.json()


@pytest.mark.asyncio
async def test_metrics_endpoint_requires_configured_bearer_token(client, monkeypatch):
    token = "metrics-test-token-that-is-long-enough-for-stage-nine"
    monkeypatch.setattr(security_headers.settings, "metrics_bearer_token", token)

    denied = await client.get("/metrics")
    allowed = await client.get(
        "/metrics",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert denied.status_code == 401
    assert allowed.status_code == 200
    assert "text/plain" in allowed.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_security_headers_apply_to_api_responses(client):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"

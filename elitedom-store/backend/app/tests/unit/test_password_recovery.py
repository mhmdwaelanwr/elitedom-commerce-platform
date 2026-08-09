"""Security tests for phone-verified password recovery."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.auth.password_recovery import PasswordRecoveryService
from app.shared.exceptions import InvalidCredentialsError
from app.shared.security import hash_password, verify_password


@pytest.mark.asyncio
async def test_password_recovery_rejects_non_otp_session():
    db = SimpleNamespace(
        scalar=AsyncMock(
            return_value=SimpleNamespace(
                auth_method="password",
                created_at=datetime.now(UTC),
            )
        ),
        execute=AsyncMock(),
        flush=AsyncMock(),
    )

    with pytest.raises(InvalidCredentialsError):
        await PasswordRecoveryService(db).recover(
            partner_id=7,
            session_id="11111111-1111-1111-1111-111111111111",
            new_password="NewPassword123!",
        )

    db.execute.assert_not_awaited()
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_password_recovery_rejects_stale_otp_session():
    db = SimpleNamespace(
        scalar=AsyncMock(
            return_value=SimpleNamespace(
                auth_method="phone_otp",
                created_at=datetime.now(UTC) - timedelta(minutes=11),
            )
        ),
        execute=AsyncMock(),
        flush=AsyncMock(),
    )

    with pytest.raises(InvalidCredentialsError):
        await PasswordRecoveryService(db).recover(
            partner_id=7,
            session_id="22222222-2222-2222-2222-222222222222",
            new_password="NewPassword123!",
        )

    db.execute.assert_not_awaited()
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_password_recovery_accepts_fresh_otp_and_revokes_other_sessions():
    otp_session = SimpleNamespace(
        auth_method="phone_otp",
        created_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    partner = SimpleNamespace(password_hash=hash_password("OldPassword123!"))
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=[otp_session, partner]),
        execute=AsyncMock(),
        flush=AsyncMock(),
    )

    await PasswordRecoveryService(db).recover(
        partner_id=7,
        session_id="33333333-3333-3333-3333-333333333333",
        new_password="NewPassword123!",
    )

    assert verify_password("NewPassword123!", partner.password_hash)
    assert not verify_password("OldPassword123!", partner.password_hash)
    db.execute.assert_awaited_once()
    db.flush.assert_awaited_once()

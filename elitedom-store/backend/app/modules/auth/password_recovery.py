"""Password recovery guarded by a fresh, verified phone-OTP session."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Partner
from app.modules.auth.models import AuthSession
from app.shared.exceptions import InvalidCredentialsError
from app.shared.security import hash_password

RECOVERY_SESSION_MAX_AGE = timedelta(minutes=10)


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class PasswordRecoveryService:
    """Allow password replacement only immediately after phone OTP verification."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def recover(
        self,
        *,
        partner_id: int,
        session_id: str | None,
        new_password: str,
    ) -> None:
        if not session_id:
            raise InvalidCredentialsError()

        now = _now()
        auth_session = await self.db.scalar(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.partner_id == partner_id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
            )
        )
        if auth_session is None or auth_session.auth_method != "phone_otp":
            raise InvalidCredentialsError()
        if now - _as_utc(auth_session.created_at) > RECOVERY_SESSION_MAX_AGE:
            raise InvalidCredentialsError()

        partner = await self.db.scalar(
            select(Partner).where(Partner.id == partner_id, Partner.is_active.is_(True))
        )
        if partner is None:
            raise InvalidCredentialsError()

        partner.password_hash = hash_password(new_password)

        # Password recovery is an account-takeover boundary. Revoke every
        # refresh-capable session, including the OTP session that authorized
        # the reset, so the customer must sign in again with the new secret.
        await self.db.execute(
            update(AuthSession)
            .where(
                AuthSession.partner_id == partner_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revoke_reason="password_recovery")
        )
        await self.db.flush()

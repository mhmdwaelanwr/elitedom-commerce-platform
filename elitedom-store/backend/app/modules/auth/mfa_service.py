"""Database-backed staff MFA enrollment and verification."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Partner
from app.modules.admin.access import STAFF_ROLES
from app.modules.auth.errors import InvalidMfaError, MfaRequiredError
from app.modules.auth.mfa import (
    consume_recovery_code,
    decrypt_totp_secret,
    encode_recovery_hashes,
    encrypt_totp_secret,
    generate_recovery_codes,
    generate_totp_secret,
    provisioning_uri,
    verify_totp,
)
from app.modules.auth.models import AdminMfaCredential, AuthSession
from app.modules.auth.schemas import (
    MfaEnrollmentConfirmResponse,
    MfaEnrollmentResponse,
    MfaStatusResponse,
)
from app.shared.exceptions import InsufficientPermissionsError, InvalidCredentialsError, ResourceConflictError


def _now() -> datetime:
    return datetime.now(UTC)


class AdminMfaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _staff_partner(self, partner_id: int) -> Partner:
        partner = await self.db.scalar(select(Partner).where(Partner.id == partner_id))
        if partner is None or not partner.is_active:
            raise InvalidCredentialsError()
        if partner.role not in STAFF_ROLES:
            raise InsufficientPermissionsError()
        return partner

    async def _session(self, partner_id: int, session_id: str | None) -> AuthSession:
        if not session_id:
            raise InvalidCredentialsError()
        session = await self.db.scalar(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.partner_id == partner_id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > _now(),
            )
        )
        if session is None:
            raise InvalidCredentialsError()
        return session

    async def status(self, *, partner_id: int, session_id: str | None) -> MfaStatusResponse:
        partner = await self.db.scalar(select(Partner).where(Partner.id == partner_id))
        if partner is None or not partner.is_active:
            raise InvalidCredentialsError()
        credential = await self.db.scalar(
            select(AdminMfaCredential).where(AdminMfaCredential.partner_id == partner_id)
        )
        enrolled = credential is not None and credential.enabled_at is not None
        session = None
        if session_id:
            session = await self.db.scalar(
                select(AuthSession).where(
                    AuthSession.id == session_id,
                    AuthSession.partner_id == partner_id,
                    AuthSession.revoked_at.is_(None),
                    AuthSession.expires_at > _now(),
                )
            )
        remaining = 0
        if credential:
            try:
                remaining = len(json.loads(credential.recovery_code_hashes or "[]"))
            except (TypeError, ValueError, json.JSONDecodeError):
                remaining = 0
        return MfaStatusResponse(
            required=partner.role in STAFF_ROLES,
            enrolled=enrolled,
            verified=bool(session and session.mfa_verified_at),
            remaining_recovery_codes=remaining,
        )

    async def begin_enrollment(self, *, partner_id: int, session_id: str | None) -> MfaEnrollmentResponse:
        partner = await self._staff_partner(partner_id)
        await self._session(partner_id, session_id)
        credential = await self.db.scalar(
            select(AdminMfaCredential).where(AdminMfaCredential.partner_id == partner_id)
        )
        if credential is not None and credential.enabled_at is not None:
            raise ResourceConflictError("Multi-factor authentication is already enabled.")
        secret = generate_totp_secret()
        if credential is None:
            credential = AdminMfaCredential(
                partner_id=partner_id,
                secret_ciphertext=encrypt_totp_secret(secret),
                recovery_code_hashes="[]",
            )
            self.db.add(credential)
        else:
            credential.secret_ciphertext = encrypt_totp_secret(secret)
            credential.recovery_code_hashes = "[]"
            credential.enabled_at = None
        await self.db.flush()
        return MfaEnrollmentResponse(
            secret=secret,
            provisioning_uri=provisioning_uri(email=partner.email, secret=secret),
        )

    async def confirm_enrollment(
        self, *, partner_id: int, session_id: str | None, code: str
    ) -> MfaEnrollmentConfirmResponse:
        await self._staff_partner(partner_id)
        session = await self._session(partner_id, session_id)
        credential = await self.db.scalar(
            select(AdminMfaCredential).where(AdminMfaCredential.partner_id == partner_id)
        )
        if credential is None:
            raise MfaRequiredError()
        if not verify_totp(decrypt_totp_secret(credential.secret_ciphertext), code):
            raise InvalidMfaError()
        recovery_codes = generate_recovery_codes()
        credential.recovery_code_hashes = encode_recovery_hashes(recovery_codes)
        credential.enabled_at = _now()
        session.mfa_verified_at = _now()
        await self.db.flush()
        return MfaEnrollmentConfirmResponse(
            status=MfaStatusResponse(
                required=True,
                enrolled=True,
                verified=True,
                remaining_recovery_codes=len(recovery_codes),
            ),
            recovery_codes=recovery_codes,
        )

    async def verify(self, *, partner_id: int, session_id: str | None, code: str) -> MfaStatusResponse:
        await self._staff_partner(partner_id)
        session = await self._session(partner_id, session_id)
        credential = await self.db.scalar(
            select(AdminMfaCredential).where(
                AdminMfaCredential.partner_id == partner_id,
                AdminMfaCredential.enabled_at.is_not(None),
            )
        )
        if credential is None:
            raise MfaRequiredError()
        accepted = verify_totp(decrypt_totp_secret(credential.secret_ciphertext), code)
        if not accepted:
            accepted, remaining = consume_recovery_code(credential.recovery_code_hashes, code)
            if accepted:
                credential.recovery_code_hashes = remaining
        if not accepted:
            raise InvalidMfaError()
        session.mfa_verified_at = _now()
        await self.db.flush()
        return await self.status(partner_id=partner_id, session_id=session_id)

    async def require_verified_staff_session(self, *, partner_id: int, session_id: str | None) -> None:
        await self._staff_partner(partner_id)
        session = await self._session(partner_id, session_id)
        credential_id = await self.db.scalar(
            select(AdminMfaCredential.id).where(
                AdminMfaCredential.partner_id == partner_id,
                AdminMfaCredential.enabled_at.is_not(None),
            )
        )
        if credential_id is None or session.mfa_verified_at is None:
            raise MfaRequiredError()

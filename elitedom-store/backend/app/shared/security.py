"""
Elitedom Store — Security Utilities
JWT token management, password hashing, and authorization helpers.
Per API_SECURITY.md and SECURITY_REQUIREMENTS.md.
"""

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.modules.auth.models import AuthSession
from app.shared.exceptions import (
    InsufficientPermissionsError,
    InvalidCredentialsError,
    TokenExpiredError,
)
from app.shared.schemas import UserRole

settings = get_settings()
security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as error:
        if "expired" in str(error).lower():
            raise TokenExpiredError() from None
        raise InvalidCredentialsError() from None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate an access token and its tracked device session."""
    if credentials is None:
        raise InvalidCredentialsError()

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise InvalidCredentialsError()

    user_id = payload.get("sub")
    if user_id is None:
        raise InvalidCredentialsError()

    session_id = payload.get("sid")
    if session_id:
        active_session = await db.scalar(
            select(AuthSession.id).where(
                AuthSession.id == str(session_id),
                AuthSession.partner_id == int(user_id),
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > func.now(),
            )
        )
        if active_session is None:
            raise InvalidCredentialsError()

    return {
        "user_id": int(user_id),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "session_id": str(session_id) if session_id else None,
    }


def require_role(*allowed_roles: UserRole):
    """Compatibility dependency for non-admin domains still using coarse roles."""

    async def role_checker(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        user_role = current_user.get("role")
        if user_role not in [role.value for role in allowed_roles]:
            raise InsufficientPermissionsError()
        return current_user

    return role_checker


async def require_staff_access(
    *,
    db: AsyncSession,
    current_user: dict,
    permissions: tuple[str, ...],
) -> tuple[str, frozenset[str]]:
    """Require persisted staff permission and the configured MFA session gate."""
    if not permissions:
        raise ValueError("At least one staff permission is required.")

    from app.modules.admin.access_service import AdminAccessService
    from app.modules.auth.mfa_service import AdminMfaService

    role, granted = await AdminAccessService(db).resolve_permissions(int(current_user["user_id"]))
    if role is None or not any(permission in granted for permission in permissions):
        raise InsufficientPermissionsError()
    if settings.staff_mfa_required:
        await AdminMfaService(db).require_verified_staff_session(
            partner_id=int(current_user["user_id"]),
            session_id=current_user.get("session_id"),
        )
    return role, granted


def require_permission(permission: str):
    """Resolve a privileged permission from persisted staff state plus MFA.

    The JWT role is never authoritative for staff authorization. In deployments
    where STAFF_MFA_REQUIRED is enabled, the tracked device session must also
    have completed an enabled staff MFA credential before any permission is
    returned. Staging and production configuration force this policy on.
    """

    async def permission_checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        role, permissions = await require_staff_access(
            db=db,
            current_user=current_user,
            permissions=(permission,),
        )
        resolved = dict(current_user)
        resolved["role"] = role
        resolved["permissions"] = sorted(permissions)
        return resolved

    return permission_checker


def verify_hmac_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

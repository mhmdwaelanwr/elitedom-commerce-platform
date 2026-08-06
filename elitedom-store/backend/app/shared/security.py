"""
Elitedom Store — Security Utilities
JWT token management, password hashing, and RBAC helpers.
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

from app.config import get_settings
from app.shared.exceptions import (
    InsufficientPermissionsError,
    InvalidCredentialsError,
    TokenExpiredError,
)
from app.shared.schemas import UserRole

settings = get_settings()
security_scheme = HTTPBearer(auto_error=False)


# ── Password Hashing (bcrypt) ────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT Token Management ─────────────────────────────────────────────────────


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token with configurable expiry."""
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
    """Create a JWT refresh token with longer expiry."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises on expiry or invalid signature."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenExpiredError() from None
        raise InvalidCredentialsError() from None


# ── FastAPI Dependencies ─────────────────────────────────────────────────────


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> dict:
    """Dependency: Extract and validate the current user from the JWT token."""
    if credentials is None:
        raise InvalidCredentialsError()

    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise InvalidCredentialsError()

    user_id = payload.get("sub")
    if user_id is None:
        raise InvalidCredentialsError()

    return {
        "user_id": int(user_id),
        "email": payload.get("email"),
        "role": payload.get("role"),
    }


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory: Restrict endpoint access to specific RBAC roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role(UserRole.SYSTEM_ADMIN))])
    """

    async def role_checker(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        user_role = current_user.get("role")
        if user_role not in [r.value for r in allowed_roles]:
            raise InsufficientPermissionsError()
        return current_user

    return role_checker


# ── HMAC Webhook Signature Validation ────────────────────────────────────────


def verify_hmac_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    """
    Verify HMAC-SHA256 signature for webhook payloads.
    Used by both Odoo and internal webhook endpoints.
    Per API_SECURITY.md: X-Elitedom-Signature header.
    """
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

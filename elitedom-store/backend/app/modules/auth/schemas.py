"""Pydantic request and response models for authentication endpoints."""

import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


def normalize_egyptian_mobile(value: str) -> str:
    """Return an Egyptian mobile in canonical E.164 form."""
    cleaned = re.sub(r"[\s\-()]", "", value)
    if re.fullmatch(r"01[0125]\d{8}", cleaned):
        return "+20" + cleaned[1:]
    if re.fullmatch(r"\+201[0125]\d{8}", cleaned):
        return cleaned
    raise ValueError(
        "Invalid Egyptian mobile number. Expected format: +201XXXXXXXXX or 01XXXXXXXXX"
    )


def validate_password_strength_value(value: str) -> str:
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", value):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", value):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
        raise ValueError("Password must contain at least one special character")
    return value


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    email: EmailStr
    mobile: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("mobile")
    @classmethod
    def validate_egyptian_mobile(cls, value: str) -> str:
        return normalize_egyptian_mobile(value)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return validate_password_strength_value(value)


class RegisterResponse(BaseModel):
    status: str = "success"
    message: str = "Account created. You can now sign in."
    user_id: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str = Field(exclude=True)
    expires_in: int = 3600
    token_type: str = "bearer"
    role: str
    user_id: int
    session_id: str
    email: str
    name: str
    mfa_required: bool = False
    mfa_enrolled: bool = False
    mfa_verified: bool = False


class PasswordRecoveryRequest(BaseModel):
    """Set a new password after a fresh phone-OTP authentication session."""

    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return validate_password_strength_value(value)


class OAuthRequest(BaseModel):
    provider: str = Field(..., pattern="^(google|apple)$")
    id_token: str = Field(..., min_length=20, max_length=8192)


class OtpRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=20)
    name: str | None = Field(default=None, min_length=2, max_length=128)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        return normalize_egyptian_mobile(value)


class OtpChallengeResponse(BaseModel):
    challenge_id: str
    expires_in: int
    resend_after: int
    delivery: str
    debug_code: str | None = None


class OtpVerifyRequest(BaseModel):
    challenge_id: str = Field(..., min_length=36, max_length=36)
    mobile: str = Field(..., min_length=10, max_length=20)
    code: str = Field(..., pattern=r"^\d{6}$")

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        return normalize_egyptian_mobile(value)


class MfaCodeRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=32)


class MfaStatusResponse(BaseModel):
    required: bool
    enrolled: bool
    verified: bool
    remaining_recovery_codes: int = 0


class MfaEnrollmentResponse(BaseModel):
    secret: str
    provisioning_uri: str


class MfaEnrollmentConfirmResponse(BaseModel):
    status: MfaStatusResponse
    recovery_codes: list[str]


class SessionResponse(BaseModel):
    id: str
    auth_method: str
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_used_at: datetime | None
    current: bool = False
    mfa_verified: bool = False


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]


class LogoutAllResponse(BaseModel):
    revoked_sessions: int

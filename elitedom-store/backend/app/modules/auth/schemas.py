"""
Elitedom Store — Auth Module Schemas
Pydantic request/response models for authentication endpoints.
"""

import re

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    email: EmailStr
    mobile: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("mobile")
    @classmethod
    def validate_egyptian_mobile(cls, v: str) -> str:
        """Validate Egyptian mobile number format."""
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(r"^(\+20|0)1[0125]\d{8}$", cleaned):
            raise ValueError(
                "Invalid Egyptian mobile number. Expected format: +201XXXXXXXXX or 01XXXXXXXXX"
            )
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class RegisterResponse(BaseModel):
    status: str = "success"
    message: str = "Account created. You can now sign in."
    user_id: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    # Router code reads this to issue an HttpOnly cookie, while Pydantic keeps
    # it out of JSON responses and browser-readable storage.
    refresh_token: str = Field(exclude=True)
    expires_in: int = 3600
    token_type: str = "bearer"
    role: str
    user_id: int


class OAuthRequest(BaseModel):
    provider: str = Field(..., pattern="^(google|apple)$")
    id_token: str

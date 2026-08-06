"""
Elitedom Store — Auth Module Router
Endpoints: POST /auth/register, POST /auth/login, POST /auth/oauth, POST /auth/refresh
Per API_SPECIFICATION.md Section 2 and FR-AUTH-001 to FR-AUTH-004.
"""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    OAuthRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter()
settings = get_settings()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Keep refresh credentials out of JSON and JavaScript-readable storage."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=settings.environment != "development",
        max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user account.
    FR-AUTH-001: Register using email, password, and mobile number.
    """
    service = AuthService(db)
    return await service.register(request)


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user and return JWT tokens.
    FR-AUTH-002: Login via email/password.
    """
    service = AuthService(db)
    result = await service.login(request)

    _set_refresh_cookie(response, result.refresh_token)

    return result


@router.post("/oauth", response_model=LoginResponse)
async def oauth_login(
    request: OAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate via Google or Apple OAuth.
    Per API_SPECIFICATION.md Section 2.3.
    """
    result = await AuthService(db).oauth_login(request)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Rotate the HttpOnly cookie and return only a short-lived access token."""
    token = request.cookies.get("refresh_token")
    if not token:
        from app.shared.exceptions import InvalidCredentialsError

        raise InvalidCredentialsError()
    result = await AuthService(db).refresh(token)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/logout", status_code=204)
async def logout(response: Response):
    """Clear the refresh token cookie."""
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth",
        secure=settings.environment != "development",
        samesite="strict",
    )
    return None

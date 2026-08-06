"""Authentication endpoints for password, phone OTP, OAuth, and sessions."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    LogoutAllResponse,
    OAuthRequest,
    OtpChallengeResponse,
    OtpRequest,
    OtpVerifyRequest,
    RegisterRequest,
    RegisterResponse,
    SessionListResponse,
)
from app.modules.auth.service import AuthService
from app.shared.exceptions import InvalidCredentialsError
from app.shared.security import get_current_user

router = APIRouter()
settings = get_settings()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _service(db: AsyncSession, request: Request) -> AuthService:
    return AuthService(
        db,
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
    )


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
    response.headers["Cache-Control"] = "no-store"


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth",
        secure=settings.environment != "development",
        samesite="strict",
    )
    response.headers["Cache-Control"] = "no-store"


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register using email, password, and an Egyptian mobile number."""
    return await AuthService(db).register(payload)


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email/password and create a revocable session."""
    result = await _service(db, request).login(payload)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/otp/request", response_model=OtpChallengeResponse, status_code=201)
async def request_phone_otp(
    payload: OtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a six-digit, rate-limited login code to an Egyptian mobile."""
    return await _service(db, request).request_phone_otp(payload)


@router.post("/otp/verify", response_model=LoginResponse)
async def verify_phone_otp(
    payload: OtpVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Consume a phone code and sign in or create the verified phone owner."""
    result = await _service(db, request).verify_phone_otp(payload)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/oauth", response_model=LoginResponse)
async def oauth_login(
    payload: OAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via a verified Google or Apple identity token."""
    result = await _service(db, request).oauth_login(payload)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Rotate the HttpOnly refresh cookie and return a short-lived access token."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise InvalidCredentialsError()
    result = await _service(db, request).refresh(token)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active browser/device sessions for the authenticated account."""
    return await _service(db, request).list_sessions(
        partner_id=current_user["user_id"],
        current_session_id=current_user.get("session_id"),
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke one session owned by the authenticated account."""
    await _service(db, request).revoke_session(
        partner_id=current_user["user_id"],
        session_id=session_id,
    )
    if session_id == current_user.get("session_id"):
        _clear_refresh_cookie(response)
    return None


@router.post("/logout-all", response_model=LogoutAllResponse)
async def logout_all(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all device sessions for the authenticated account."""
    result = await _service(db, request).logout_all(partner_id=current_user["user_id"])
    _clear_refresh_cookie(response)
    return result


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the current session and clear its refresh cookie."""
    await _service(db, request).logout(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
    )
    _clear_refresh_cookie(response)
    return None

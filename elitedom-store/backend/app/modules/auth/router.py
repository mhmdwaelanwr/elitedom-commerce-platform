"""Authentication endpoints for password, phone OTP, OAuth, sessions, and staff MFA."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.modules.auth.mfa_service import AdminMfaService
from app.modules.auth.models import AuthSession, OtpChallenge
from app.modules.auth.password_recovery import PasswordRecoveryService
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    LogoutAllResponse,
    MfaCodeRequest,
    MfaEnrollmentConfirmResponse,
    MfaEnrollmentResponse,
    MfaStatusResponse,
    OAuthRequest,
    OtpChallengeResponse,
    OtpRequest,
    OtpVerifyRequest,
    PasswordRecoveryRequest,
    RegisterRequest,
    RegisterResponse,
    SessionListResponse,
)
from app.modules.auth.service import AuthService
from app.shared.exceptions import InvalidCredentialsError
from app.shared.security import decode_token, get_current_user

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


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


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
    _no_store(response)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth",
        secure=settings.environment != "development",
        samesite="strict",
    )
    _no_store(response)


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).register(payload)


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await _service(db, request).login(payload)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/otp/request", response_model=OtpChallengeResponse, status_code=201)
async def request_phone_otp(
    payload: OtpRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await _service(db, request).request_phone_otp(payload)
    _no_store(response)
    return result


@router.post("/otp/verify", response_model=LoginResponse)
async def verify_phone_otp(
    payload: OtpVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Serialize all verification attempts for one challenge. AuthService then
    # performs its existing attempt/expiry/hash checks while this row lock is
    # held until the request transaction commits.
    await db.scalar(
        select(OtpChallenge.id)
        .where(
            OtpChallenge.id == payload.challenge_id,
            OtpChallenge.mobile == payload.mobile,
        )
        .with_for_update()
    )
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
    result = await _service(db, request).oauth_login(payload)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get("refresh_token")
    if not token:
        raise InvalidCredentialsError()

    # Stateful sessions are now mandatory. Reject legacy sid-less refresh
    # credentials rather than allowing replayable compatibility upgrades.
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise InvalidCredentialsError()
    session_id = payload.get("sid")
    if not session_id:
        raise InvalidCredentialsError()

    # Serialize refresh rotation for one session. The service checks the old
    # token hash and replaces it while this lock is held, so two concurrent
    # requests cannot both consume the same refresh credential.
    await db.scalar(
        select(AuthSession.id)
        .where(AuthSession.id == str(session_id))
        .with_for_update()
    )
    result = await _service(db, request).refresh(token)
    _set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/password/recovery", status_code=204)
async def recover_password(
    payload: PasswordRecoveryRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace a password only from a freshly verified phone-OTP session."""
    await PasswordRecoveryService(db).recover(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
        new_password=payload.new_password,
    )
    _clear_refresh_cookie(response)
    return None


@router.get("/mfa/status", response_model=MfaStatusResponse)
async def mfa_status(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await AdminMfaService(db).status(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
    )
    _no_store(response)
    return result


@router.post("/mfa/enroll", response_model=MfaEnrollmentResponse)
async def begin_mfa_enrollment(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await AdminMfaService(db).begin_enrollment(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
    )
    _no_store(response)
    return result


@router.post("/mfa/confirm", response_model=MfaEnrollmentConfirmResponse)
async def confirm_mfa_enrollment(
    payload: MfaCodeRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await AdminMfaService(db).confirm_enrollment(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
        code=payload.code,
    )
    _no_store(response)
    return result


@router.post("/mfa/verify", response_model=MfaStatusResponse)
async def verify_mfa(
    payload: MfaCodeRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await AdminMfaService(db).verify(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
        code=payload.code,
    )
    _no_store(response)
    return result


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    await _service(db, request).logout(
        partner_id=current_user["user_id"],
        session_id=current_user.get("session_id"),
    )
    _clear_refresh_cookie(response)
    return None

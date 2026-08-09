"""Authentication, verified identity linking, and revocable session management."""

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import httpx
from jose import jwk, jwt
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Partner
from app.modules.auth.delivery import deliver_otp
from app.modules.auth.errors import InvalidOtpError, OtpRateLimitError
from app.modules.auth.models import AuthIdentity, AuthSession, OtpChallenge
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
    SessionResponse,
)
from app.shared.events import CustomerRegistered
from app.shared.exceptions import (
    AccountAlreadyExistsError,
    InvalidCredentialsError,
    TokenExpiredError,
)
from app.shared.outbox import publish_domain_event
from app.shared.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)
settings = get_settings()

OTP_EXPIRES_IN_SECONDS = 5 * 60
OTP_RESEND_AFTER_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
OTP_HOURLY_LIMIT = 5


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_otp(challenge_id: str, mobile: str, code: str) -> str:
    payload = f"{challenge_id}:{mobile}:{code}".encode()
    return hmac.new(settings.secret_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()


class AuthService:
    """Authentication and authorization business logic."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ):
        self.db = db
        self.user_agent = user_agent[:512] if user_agent else None
        self.ip_address = ip_address[:64] if ip_address else None

    async def register(self, request: RegisterRequest) -> RegisterResponse:
        """Register a new customer account using email and password."""
        existing = await self.db.execute(
            select(Partner).where(func.lower(Partner.email) == request.email.lower())
        )
        partner = existing.scalar_one_or_none()

        if partner is not None:
            # Email equality is not proof that the caller owns a guest contact.
            # A passwordless guest can safely establish credentials only through
            # the verified phone-OTP password-recovery flow.
            raise AccountAlreadyExistsError()
        else:
            partner = Partner(
                name=request.name,
                email=request.email.lower(),
                phone=request.mobile,
                password_hash=hash_password(request.password),
                company_type="person",
                role="customer",
            )
            self.db.add(partner)
        await self.db.flush()

        await publish_domain_event(
            self.db,
            CustomerRegistered(payload={"user_id": partner.id, "email": partner.email}),
        )

        logger.info("New customer registered (ID: %s)", partner.id)
        return RegisterResponse(user_id=partner.id)

    async def login(self, request: LoginRequest) -> LoginResponse:
        """Authenticate an email/password account and create a device session."""
        result = await self.db.execute(
            select(Partner).where(func.lower(Partner.email) == request.email.lower())
        )
        partner = result.scalar_one_or_none()

        if not partner or not partner.password_hash:
            raise InvalidCredentialsError()
        if not verify_password(request.password, partner.password_hash):
            raise InvalidCredentialsError()
        if not partner.is_active:
            raise InvalidCredentialsError()

        logger.info("User logged in (ID: %s)", partner.id)
        return await self._issue_tokens(partner, auth_method="password")

    async def oauth_login(self, request: OAuthRequest) -> LoginResponse:
        """Verify Google or Apple identity and link it to one Elitedom account."""
        subject, email, name = await self._verify_oauth_identity(
            provider=request.provider,
            id_token=request.id_token,
        )
        partner, created = await self._get_or_link_oauth_partner(
            provider=request.provider,
            subject=subject,
            email=email,
            name=name,
        )

        if created:
            await publish_domain_event(
                self.db,
                CustomerRegistered(payload={"user_id": partner.id, "email": partner.email}),
            )
            logger.info(
                "New OAuth customer created via %s (ID: %s)",
                request.provider,
                partner.id,
            )
        else:
            logger.info(
                "OAuth login successful via %s (ID: %s)",
                request.provider,
                partner.id,
            )

        return await self._issue_tokens(partner, auth_method=request.provider)

    async def request_phone_otp(self, request: OtpRequest) -> OtpChallengeResponse:
        """Create and deliver a rate-limited, single-use phone challenge."""
        now = _now()
        latest = await self.db.scalar(
            select(OtpChallenge)
            .where(OtpChallenge.mobile == request.mobile)
            .order_by(OtpChallenge.created_at.desc())
            .limit(1)
        )
        if latest is not None:
            elapsed = int((now - _as_utc(latest.created_at)).total_seconds())
            if elapsed < OTP_RESEND_AFTER_SECONDS:
                raise OtpRateLimitError(OTP_RESEND_AFTER_SECONDS - elapsed)

        recent_count = await self.db.scalar(
            select(func.count(OtpChallenge.id)).where(
                OtpChallenge.mobile == request.mobile,
                OtpChallenge.created_at >= now - timedelta(hours=1),
            )
        )
        if int(recent_count or 0) >= OTP_HOURLY_LIMIT:
            raise OtpRateLimitError(60 * 60)

        challenge_id = str(uuid.uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = OtpChallenge(
            id=challenge_id,
            mobile=request.mobile,
            code_hash=_hash_otp(challenge_id, request.mobile, code),
            request_ip=self.ip_address,
            requested_name=request.name,
            attempts=0,
            expires_at=now + timedelta(seconds=OTP_EXPIRES_IN_SECONDS),
        )
        self.db.add(challenge)
        await self.db.flush()

        delivered = await deliver_otp(request.mobile, code)
        return OtpChallengeResponse(
            challenge_id=challenge_id,
            expires_in=OTP_EXPIRES_IN_SECONDS,
            resend_after=OTP_RESEND_AFTER_SECONDS,
            delivery="sms" if delivered else "debug",
            debug_code=code if not delivered and settings.environment == "development" else None,
        )

    async def verify_phone_otp(self, request: OtpVerifyRequest) -> LoginResponse:
        """Atomically consume a phone challenge and sign in or create the phone owner."""
        now = _now()
        challenge = await self.db.scalar(
            select(OtpChallenge)
            .where(
                OtpChallenge.id == request.challenge_id,
                OtpChallenge.mobile == request.mobile,
            )
            .with_for_update()
        )
        if challenge is None or challenge.consumed_at is not None:
            raise InvalidOtpError()
        if _as_utc(challenge.expires_at) <= now:
            raise InvalidOtpError()
        if challenge.attempts >= OTP_MAX_ATTEMPTS:
            raise InvalidOtpError("Too many failed verification attempts. Request a new code.")

        challenge.attempts += 1
        expected_hash = _hash_otp(challenge.id, challenge.mobile, request.code)
        if not hmac.compare_digest(challenge.code_hash, expected_hash):
            if challenge.attempts >= OTP_MAX_ATTEMPTS:
                challenge.consumed_at = now
            # Persist failed-attempt accounting before returning a 401. The
            # outer request transaction would otherwise roll it back.
            await self.db.commit()
            raise InvalidOtpError()

        challenge.consumed_at = now
        partner, created = await self._get_or_link_phone_partner(
            mobile=request.mobile,
            name=challenge.requested_name,
        )
        if created:
            await publish_domain_event(
                self.db,
                CustomerRegistered(payload={"user_id": partner.id, "email": partner.email}),
            )
        return await self._issue_tokens(partner, auth_method="phone_otp")

    async def refresh(self, refresh_token: str) -> LoginResponse:
        """Atomically rotate a tracked refresh credential and reject replay."""
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise TokenExpiredError()

        user_id = payload.get("sub")
        if user_id is None:
            raise InvalidCredentialsError()
        partner = await self.db.scalar(select(Partner).where(Partner.id == int(user_id)))
        if not partner or not partner.is_active:
            raise InvalidCredentialsError()

        session_id = payload.get("sid")
        if not session_id:
            # Legacy stateless refresh credentials cannot participate in
            # session revocation or one-time rotation. Fail closed instead of
            # recreating a tracked session from a replayable bearer token.
            raise InvalidCredentialsError()

        auth_session = await self.db.scalar(
            select(AuthSession)
            .where(
                AuthSession.id == str(session_id),
                AuthSession.partner_id == partner.id,
            )
            .with_for_update()
        )
        if (
            auth_session is None
            or auth_session.revoked_at is not None
            or _as_utc(auth_session.expires_at) <= _now()
        ):
            raise InvalidCredentialsError()

        if not hmac.compare_digest(
            auth_session.refresh_token_hash,
            _hash_refresh_token(refresh_token),
        ):
            auth_session.revoked_at = _now()
            auth_session.revoke_reason = "refresh_replay"
            await self.db.commit()
            raise InvalidCredentialsError()

        auth_session.last_used_at = _now()
        return await self._issue_tokens(
            partner,
            auth_method=auth_session.auth_method,
            existing_session=auth_session,
        )

    async def logout(self, *, partner_id: int, session_id: str | None) -> None:
        """Revoke the current tracked session."""
        if not session_id:
            return
        auth_session = await self.db.scalar(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.partner_id == partner_id,
            )
        )
        if auth_session and auth_session.revoked_at is None:
            auth_session.revoked_at = _now()
            auth_session.revoke_reason = "logout"

    async def revoke_session(
        self,
        *,
        partner_id: int,
        session_id: str,
    ) -> None:
        """Revoke one session owned by the authenticated customer."""
        auth_session = await self.db.scalar(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.partner_id == partner_id,
            )
        )
        if auth_session and auth_session.revoked_at is None:
            auth_session.revoked_at = _now()
            auth_session.revoke_reason = "user_revoked"

    async def logout_all(self, *, partner_id: int) -> LogoutAllResponse:
        """Revoke every active session for a customer account."""
        result = await self.db.execute(
            update(AuthSession)
            .where(
                AuthSession.partner_id == partner_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=_now(), revoke_reason="logout_all")
        )
        return LogoutAllResponse(revoked_sessions=int(result.rowcount or 0))

    async def list_sessions(
        self,
        *,
        partner_id: int,
        current_session_id: str | None,
    ) -> SessionListResponse:
        """List non-revoked device sessions for account security settings."""
        sessions = list(
            (
                await self.db.scalars(
                    select(AuthSession)
                    .where(
                        AuthSession.partner_id == partner_id,
                        AuthSession.revoked_at.is_(None),
                        AuthSession.expires_at > _now(),
                    )
                    .order_by(AuthSession.created_at.desc())
                )
            ).all()
        )
        return SessionListResponse(
            sessions=[
                SessionResponse(
                    id=session.id,
                    auth_method=session.auth_method,
                    user_agent=session.user_agent,
                    ip_address=session.ip_address,
                    created_at=session.created_at,
                    last_used_at=session.last_used_at,
                    current=session.id == current_session_id,
                )
                for session in sessions
            ]
        )

    async def _issue_tokens(
        self,
        partner: Partner,
        *,
        auth_method: str,
        existing_session: AuthSession | None = None,
    ) -> LoginResponse:
        now = _now()
        session_id = existing_session.id if existing_session else str(uuid.uuid4())
        token_data = {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
            "sid": session_id,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({**token_data, "jti": secrets.token_urlsafe(24)})

        if existing_session is None:
            auth_session = AuthSession(
                id=session_id,
                partner_id=partner.id,
                refresh_token_hash=_hash_refresh_token(refresh_token),
                auth_method=auth_method,
                user_agent=self.user_agent,
                ip_address=self.ip_address,
                last_used_at=now,
                expires_at=now + timedelta(days=settings.jwt_refresh_token_expire_days),
            )
            self.db.add(auth_session)
        else:
            existing_session.refresh_token_hash = _hash_refresh_token(refresh_token)
            existing_session.last_used_at = now
            existing_session.user_agent = self.user_agent or existing_session.user_agent
            existing_session.ip_address = self.ip_address or existing_session.ip_address
            existing_session.expires_at = now + timedelta(
                days=settings.jwt_refresh_token_expire_days
            )
        await self.db.flush()

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            role=partner.role,
            user_id=partner.id,
            session_id=session_id,
            email=partner.email,
            name=partner.name,
        )

    async def _get_or_link_phone_partner(
        self,
        *,
        mobile: str,
        name: str | None,
    ) -> tuple[Partner, bool]:
        identity = await self.db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.provider == "phone",
                AuthIdentity.subject == mobile,
            )
        )
        now = _now()
        if identity:
            partner = await self.db.scalar(select(Partner).where(Partner.id == identity.partner_id))
            if not partner or not partner.is_active:
                raise InvalidCredentialsError()
            identity.last_used_at = now
            return partner, False

        local_mobile = "0" + mobile[3:]
        matches = list(
            (
                await self.db.scalars(
                    select(Partner).where(Partner.phone.in_([mobile, local_mobile]))
                )
            ).all()
        )
        if len(matches) > 1:
            raise InvalidCredentialsError()

        created = not matches
        if matches:
            partner = matches[0]
            if not partner.is_active:
                raise InvalidCredentialsError()
            partner.phone = mobile
            if name and not partner.name.strip():
                partner.name = name
        else:
            digits = mobile.removeprefix("+")
            partner = Partner(
                name=name or "Elitedom Customer",
                email=f"phone.{digits}@phone.elitedom.local",
                phone=mobile,
                password_hash=None,
                company_type="person",
                role="customer",
            )
            self.db.add(partner)
            await self.db.flush()

        self.db.add(
            AuthIdentity(
                partner_id=partner.id,
                provider="phone",
                subject=mobile,
                email=None,
                last_used_at=now,
            )
        )
        await self.db.flush()
        return partner, created

    async def _get_or_link_oauth_partner(
        self,
        *,
        provider: str,
        subject: str,
        email: str,
        name: str,
    ) -> tuple[Partner, bool]:
        provider = provider.lower().strip()
        identity = await self.db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.provider == provider,
                AuthIdentity.subject == subject,
            )
        )
        now = _now()
        if identity:
            partner = await self.db.scalar(select(Partner).where(Partner.id == identity.partner_id))
            if not partner or not partner.is_active:
                raise InvalidCredentialsError()
            identity.last_used_at = now
            return partner, False

        partner = await self.db.scalar(
            select(Partner).where(func.lower(Partner.email) == email.lower())
        )
        created = partner is None
        if partner:
            if not partner.is_active:
                raise InvalidCredentialsError()
            existing_provider = await self.db.scalar(
                select(AuthIdentity).where(
                    AuthIdentity.partner_id == partner.id,
                    AuthIdentity.provider == provider,
                )
            )
            if existing_provider:
                raise InvalidCredentialsError()
            if name and not partner.name.strip():
                partner.name = name
            partner.email_verified = True
        else:
            phone_suffix = hashlib.sha256(email.lower().encode("utf-8")).hexdigest()[:12]
            partner = Partner(
                name=name,
                email=email.lower(),
                phone=f"oauth-{phone_suffix}",
                password_hash=None,
                company_type="person",
                role="customer",
                email_verified=True,
            )
            self.db.add(partner)
            await self.db.flush()

        self.db.add(
            AuthIdentity(
                partner_id=partner.id,
                provider=provider,
                subject=subject,
                email=email.lower(),
                last_used_at=now,
            )
        )
        await self.db.flush()
        return partner, created

    async def _verify_oauth_identity(
        self,
        *,
        provider: str,
        id_token: str,
    ) -> tuple[str, str, str]:
        provider = provider.lower().strip()
        if provider == "google":
            return await self._verify_google_id_token(id_token)
        if provider == "apple":
            return await self._verify_apple_id_token(id_token)
        raise InvalidCredentialsError()

    async def _verify_google_id_token(self, id_token: str) -> tuple[str, str, str]:
        if not settings.google_oauth_client_id.strip():
            raise InvalidCredentialsError()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": id_token},
                )
                if response.status_code != 200:
                    raise InvalidCredentialsError()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise InvalidCredentialsError() from None

        if payload.get("iss") not in {
            "accounts.google.com",
            "https://accounts.google.com",
        }:
            raise InvalidCredentialsError()
        if payload.get("aud") != settings.google_oauth_client_id:
            raise InvalidCredentialsError()
        if payload.get("email_verified") not in {"true", True, "True", 1, "1"}:
            raise InvalidCredentialsError()

        subject = payload.get("sub")
        email = payload.get("email")
        if not subject or not email:
            raise InvalidCredentialsError()
        name = payload.get("name") or payload.get("given_name") or email.split("@", 1)[0]
        return str(subject), email.lower(), str(name).strip()

    async def _verify_apple_id_token(self, id_token: str) -> tuple[str, str, str]:
        if not settings.apple_oauth_client_id.strip():
            raise InvalidCredentialsError()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                jwks_response = await client.get("https://appleid.apple.com/auth/keys")
                jwks_response.raise_for_status()
                jwks = jwks_response.json()
        except (httpx.HTTPError, ValueError):
            raise InvalidCredentialsError() from None

        try:
            header = jwt.get_unverified_header(id_token)
        except Exception:
            raise InvalidCredentialsError() from None

        kid = header.get("kid")
        algorithm = header.get("alg", "RS256")
        key_data = next(
            (key for key in jwks.get("keys", []) if key.get("kid") == kid),
            None,
        )
        if not key_data:
            raise InvalidCredentialsError()

        try:
            public_key = jwk.construct(key_data, algorithm=algorithm)
            payload = jwt.decode(
                id_token,
                public_key.to_pem().decode("utf-8"),
                algorithms=[algorithm],
                issuer="https://appleid.apple.com",
                audience=settings.apple_oauth_client_id,
            )
        except Exception:
            raise InvalidCredentialsError() from None

        subject = payload.get("sub")
        if not subject:
            raise InvalidCredentialsError()
        if payload.get("email_verified") not in {None, "true", True, "True", 1, "1"}:
            raise InvalidCredentialsError()
        email = payload.get("email") or f"{subject}@apple.oauth.elitedom.local"
        name = payload.get("name") or email.split("@", 1)[0]
        return str(subject), str(email).lower(), str(name).strip()

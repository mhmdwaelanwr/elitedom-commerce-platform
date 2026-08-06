"""
Elitedom Store — Auth Module Service
Business logic for user registration, authentication, and token management.
"""

import logging

import httpx
from jose import jwk, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Partner
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    OAuthRequest,
    RegisterRequest,
    RegisterResponse,
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


class AuthService:
    """Authentication and authorization business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, request: RegisterRequest) -> RegisterResponse:
        """Register a new customer account (FR-AUTH-001)."""
        existing = await self.db.execute(
            select(Partner).where(func.lower(Partner.email) == request.email.lower())
        )
        partner = existing.scalar_one_or_none()

        if partner is not None:
            # A prior guest checkout creates a contact-only partner so its
            # order can be retained.  The email owner may safely claim that
            # record by registering; existing password/OAuth accounts remain
            # protected from replacement.
            if partner.password_hash or partner.email_verified:
                raise AccountAlreadyExistsError()
            partner.name = request.name
            partner.phone = request.mobile
            partner.password_hash = hash_password(request.password)
            partner.company_type = "person"
            partner.role = "customer"
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
            self.db, CustomerRegistered(payload={"user_id": partner.id, "email": partner.email})
        )

        logger.info("New customer registered (ID: %s)", partner.id)
        return RegisterResponse(user_id=partner.id)

    async def login(self, request: LoginRequest) -> LoginResponse:
        """Authenticate user and issue JWT tokens (FR-AUTH-002)."""
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
        return self._issue_tokens(partner)

    async def oauth_login(self, request: OAuthRequest) -> LoginResponse:
        """
        Authenticate via Google or Apple OAuth and mint Elitedom JWTs.

        Google uses OAuth tokeninfo for verification.
        Apple uses the published JWKS set.
        """
        email, name = await self._verify_oauth_identity(
            provider=request.provider,
            id_token=request.id_token,
        )

        partner, created = await self._get_or_create_oauth_partner(email=email, name=name)

        if created:
            await publish_domain_event(
                self.db, CustomerRegistered(payload={"user_id": partner.id, "email": partner.email})
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

        return self._issue_tokens(partner)

    async def refresh(self, refresh_token: str) -> LoginResponse:
        """Refresh an expired access token."""
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise TokenExpiredError()

        user_id = payload.get("sub")
        result = await self.db.execute(select(Partner).where(Partner.id == int(user_id)))
        partner = result.scalar_one_or_none()

        if not partner or not partner.is_active:
            raise InvalidCredentialsError()

        return self._issue_tokens(partner)

    def _issue_tokens(self, partner: Partner) -> LoginResponse:
        token_data = {
            "sub": str(partner.id),
            "email": partner.email,
            "role": partner.role,
        }

        return LoginResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            role=partner.role,
            user_id=partner.id,
        )

    async def _get_or_create_oauth_partner(self, *, email: str, name: str) -> tuple[Partner, bool]:
        result = await self.db.execute(select(Partner).where(Partner.email == email))
        partner = result.scalar_one_or_none()

        if partner:
            if not partner.is_active:
                raise InvalidCredentialsError()
            if name and partner.name != name:
                partner.name = name
            partner.email_verified = True
            await self.db.flush()
            return partner, False

        placeholder_phone = f"oauth-{abs(hash(email.lower())) % 10**10}"
        partner = Partner(
            name=name,
            email=email.lower(),
            phone=placeholder_phone[:20],
            password_hash=None,
            company_type="person",
            role="customer",
            email_verified=True,
        )
        self.db.add(partner)
        await self.db.flush()
        return partner, True

    async def _verify_oauth_identity(self, *, provider: str, id_token: str) -> tuple[str, str]:
        provider = provider.lower().strip()
        if provider == "google":
            return await self._verify_google_id_token(id_token)
        if provider == "apple":
            return await self._verify_apple_id_token(id_token)
        raise InvalidCredentialsError()

    async def _verify_google_id_token(self, id_token: str) -> tuple[str, str]:
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

        issuer = payload.get("iss")
        if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
            raise InvalidCredentialsError()

        audience = payload.get("aud")
        if settings.google_oauth_client_id and audience != settings.google_oauth_client_id:
            raise InvalidCredentialsError()

        if payload.get("email_verified") not in {"true", True, "True", 1, "1"}:
            raise InvalidCredentialsError()

        email = payload.get("email")
        if not email:
            raise InvalidCredentialsError()

        name = payload.get("name") or payload.get("given_name") or email.split("@", 1)[0]
        return email.lower(), name.strip()

    async def _verify_apple_id_token(self, id_token: str) -> tuple[str, str]:
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
        key_data = next((key for key in jwks.get("keys", []) if key.get("kid") == kid), None)
        if not key_data:
            raise InvalidCredentialsError()

        try:
            public_key = jwk.construct(key_data, algorithm=algorithm)
            decode_kwargs = {
                "algorithms": [algorithm],
                "issuer": "https://appleid.apple.com",
            }
            if settings.apple_oauth_client_id:
                decode_kwargs["audience"] = settings.apple_oauth_client_id
            else:
                decode_kwargs["options"] = {"verify_aud": False}

            payload = jwt.decode(
                id_token,
                public_key.to_pem().decode("utf-8"),
                **decode_kwargs,
            )
        except Exception:
            raise InvalidCredentialsError() from None

        email = payload.get("email") or f"{payload['sub']}@apple.oauth.elitedom.local"
        if payload.get("email_verified") not in {None, "true", True, "True", 1, "1"}:
            raise InvalidCredentialsError()

        name = payload.get("name") or email.split("@", 1)[0]
        return email.lower(), name.strip()

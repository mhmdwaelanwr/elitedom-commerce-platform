"""
Elitedom Store — FastAPI Configuration
Centralized settings via pydantic-settings with .env file support.
"""

from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRET_MARKERS = (
    "change_me",
    "changeme",
    "placeholder",
    "replace_me",
    "replace-with",
    "your_",
    "your-",
    "example",
    "dummy",
    "not-set",
)


def is_secure_secret(value: object, *, minimum_length: int = 32) -> bool:
    """Return whether a deployment secret is non-empty and non-placeholder."""
    if not isinstance(value, str):
        return False
    normalized = value.strip()
    if len(normalized) < minimum_length:
        return False
    lowered = normalized.lower()
    return not any(marker in lowered for marker in _PLACEHOLDER_SECRET_MARKERS)


def is_https_url(value: str) -> bool:
    """Return whether a URL is HTTPS, absolute, and contains no credentials."""
    parsed = urlsplit(value.strip())
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and parsed.username is None
        and parsed.password is None
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── General ──────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    secret_key: str = Field(..., min_length=32)
    app_name: str = "Elitedom Store"
    app_version: str = "1.0.0"
    allowed_hosts: str = "localhost,127.0.0.1"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    log_level: str = "INFO"
    metrics_enabled: bool = True
    otel_service_name: str = "elitedom-fastapi"
    otel_exporter_otlp_endpoint: str = ""
    otel_trace_sample_ratio: float = Field(default=0.1, ge=0, le=1)
    trusted_proxy_ips: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured browser origins without accepting a wildcard."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_proxy_ip_set(self) -> set[str]:
        """Return explicit reverse-proxy IPs allowed to forward client IPs."""
        return {address.strip() for address in self.trusted_proxy_ips.split(",") if address.strip()}

    # ── PostgreSQL ───────────────────────────────────────────────────────
    postgres_user: str = "elitedom"
    postgres_password: str = Field(...)
    postgres_db: str = "elitedom_db"
    app_postgres_db: str = "elitedom_store"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.app_postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.app_postgres_db}"
        )

    # ── Redis ────────────────────────────────────────────────────────────
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = "elitedom_redis"

    @property
    def redis_url(self) -> str:
        return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"

    @property
    def celery_broker_url(self) -> str:
        return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/1"

    @property
    def celery_result_backend(self) -> str:
        return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/2"

    # ── JWT ──────────────────────────────────────────────────────────────
    jwt_secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # ── OAuth ────────────────────────────────────────────────────────────
    google_oauth_client_id: str = ""
    apple_oauth_client_id: str = ""

    # ── Odoo 17 ──────────────────────────────────────────────────────────
    odoo_url: str = "http://odoo:8069"
    odoo_db: str = "elitedom_db"
    odoo_api_user: str = "elitedom_api_user"
    odoo_api_key: str = ""
    odoo_webhook_secret: str = ""

    # ── Stripe ───────────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_currency: str = "egp"
    stripe_checkout_success_url: str = ""
    stripe_checkout_cancel_url: str = ""

    # ── Algolia ──────────────────────────────────────────────────────────
    algolia_app_id: str = ""
    algolia_api_key: str = ""
    algolia_search_key: str = ""
    algolia_index_name: str = "elitedom_products"

    # ── Twilio ───────────────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_messaging_service_sid: str = ""

    # ── SendGrid ─────────────────────────────────────────────────────────
    sendgrid_enabled: bool = False
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@elitedom.store"
    sendgrid_from_name: str = "Elitedom Store"

    # ── ZeptoMail ────────────────────────────────────────────────────────
    zeptomail_enabled: bool = False
    zeptomail_api_key: str = ""
    zeptomail_api_url: str = "https://api.zeptomail.com/v1.1/email"
    zeptomail_from_email: str = "noreply@elitedom.store"
    zeptomail_from_name: str = "Elitedom Store"
    zeptomail_bounce_address: str = "bounce@elitedom.store"

    # ── Zoho ─────────────────────────────────────────────────────────────
    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_refresh_token: str = ""
    zoho_org_id: str = ""

    # ── Hedera ───────────────────────────────────────────────────────────
    hedera_enabled: bool = False
    hedera_network: Literal["mainnet", "testnet"] = "testnet"
    hedera_operator_id: str = ""
    hedera_operator_key: str = ""
    hedera_topic_id: str = ""

    @field_validator("allowed_hosts")
    @classmethod
    def parse_allowed_hosts(cls, value: str) -> str:
        return value

    @model_validator(mode="after")
    def validate_deployment_safety(self) -> "Settings":
        """Reject unsafe configuration before the application serves traffic."""
        if self.app_postgres_db == self.odoo_db:
            raise ValueError(
                "APP_POSTGRES_DB must be different from ODOO_DB to prevent schema collisions."
            )

        integration_errors: list[str] = []
        if self.sendgrid_enabled and not is_secure_secret(
            self.sendgrid_api_key, minimum_length=20
        ):
            integration_errors.append("SENDGRID_API_KEY")
        if self.zeptomail_enabled and not is_secure_secret(
            self.zeptomail_api_key, minimum_length=20
        ):
            integration_errors.append("ZEPTOMAIL_API_KEY")
        if self.zeptomail_enabled and not is_https_url(self.zeptomail_api_url):
            integration_errors.append("ZEPTOMAIL_API_URL")
        if integration_errors:
            raise ValueError(
                "Enabled integrations require valid, non-placeholder configuration for: "
                + ", ".join(integration_errors)
            )

        if self.hedera_enabled:
            raise ValueError(
                "HEDERA_ENABLED=true is unsupported until real HCS submission is implemented."
            )

        if self.environment not in {"staging", "production"}:
            return self

        if self.debug:
            raise ValueError("DEBUG must be false in staging and production.")
        if "*" in self.allowed_hosts.split(","):
            raise ValueError("ALLOWED_HOSTS must not contain '*' outside development.")
        if "*" in self.cors_origin_list:
            raise ValueError("CORS_ORIGINS must not contain '*' outside development.")

        required_secrets = {
            "SECRET_KEY": self.secret_key,
            "JWT_SECRET_KEY": self.jwt_secret_key,
            "POSTGRES_PASSWORD": self.postgres_password,
            "REDIS_PASSWORD": self.redis_password,
            "ODOO_WEBHOOK_SECRET": self.odoo_webhook_secret,
        }
        invalid = [
            name for name, value in required_secrets.items() if not is_secure_secret(value)
        ]
        if invalid:
            raise ValueError(
                "Staging/production requires generated, non-placeholder secrets for: "
                + ", ".join(invalid)
            )
        if self.secret_key == self.jwt_secret_key:
            raise ValueError(
                "SECRET_KEY and JWT_SECRET_KEY must be distinct outside development."
            )
        return self


@lru_cache()
def get_settings() -> Settings:
    """Cached singleton for application settings."""
    return Settings()  # type: ignore[call-arg]

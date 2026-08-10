"""Elitedom Store application configuration."""

from __future__ import annotations

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
_ALLOWED_INTERNAL_HTTP_HOSTS = {
    "odoo",
    "fastapi",
    "minio",
    "localhost",
    "127.0.0.1",
    "::1",
}


def is_secure_secret(value: object, *, minimum_length: int = 32) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip()
    return len(normalized) >= minimum_length and not any(
        marker in normalized.lower() for marker in _PLACEHOLDER_SECRET_MARKERS
    )


def is_https_url(value: str) -> bool:
    parsed = urlsplit(value.strip())
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and parsed.username is None
        and parsed.password is None
    )


def is_safe_service_url(value: str) -> bool:
    parsed = urlsplit(value.strip())
    if not parsed.netloc or parsed.username is not None or parsed.password is not None:
        return False
    if parsed.scheme == "https":
        return True
    return parsed.scheme == "http" and (
        parsed.hostname or ""
    ).casefold() in _ALLOWED_INTERNAL_HTTP_HOSTS


def is_valid_sentry_dsn(value: str) -> bool:
    """Accept hosted or self-hosted HTTPS DSNs without treating the public key as a secret."""

    parsed = urlsplit(value.strip())
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and bool(parsed.username)
        and parsed.password is None
        and parsed.path not in {"", "/"}
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    secret_key: str = Field(..., min_length=32)
    app_name: str = "Elitedom Store"
    app_version: str = "1.0.0"
    allowed_hosts: str = "localhost,127.0.0.1"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    log_level: str = "INFO"
    metrics_enabled: bool = True
    metrics_bearer_token: str = ""
    otel_service_name: str = "elitedom-fastapi"
    otel_exporter_otlp_endpoint: str = ""
    otel_trace_sample_ratio: float = Field(default=0.1, ge=0, le=1)
    sentry_enabled: bool = False
    sentry_dsn: str = ""
    sentry_release: str = ""
    sentry_error_sample_rate: float = Field(default=1.0, ge=0, le=1)
    sentry_traces_sample_rate: float = Field(default=0.1, ge=0, le=1)
    trusted_proxy_ips: str = ""
    staff_mfa_required: bool = False
    rate_limit_backend: Literal["memory", "redis"] = "memory"
    rate_limit_default_per_minute: int = Field(default=100, ge=10, le=10_000)
    readiness_timeout_seconds: float = Field(default=2.0, ge=0.2, le=10.0)

    media_root: str = "media"
    media_public_path: str = "/media"
    media_storage_provider: Literal["local", "s3"] = "local"
    media_cdn_base_url: str = ""
    s3_bucket: str = ""
    s3_region: str = "eu-central-1"
    s3_endpoint_url: str = ""
    product_image_max_bytes: int = Field(default=5_242_880, ge=65_536, le=20_971_520)

    allow_staging_fixtures: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_proxy_ip_set(self) -> set[str]:
        return {
            address.strip()
            for address in self.trusted_proxy_ips.split(",")
            if address.strip()
        }

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

    jwt_secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    google_oauth_client_id: str = ""
    apple_oauth_client_id: str = ""

    odoo_sync_enabled: bool = False
    odoo_webhooks_enabled: bool = False
    odoo_url: str = "http://odoo:8069"
    odoo_db: str = "elitedom_db"
    odoo_api_user: str = "elitedom_api_user"
    odoo_api_key: str = ""
    odoo_webhook_secret: str = ""

    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_currency: str = "egp"
    stripe_checkout_success_url: str = ""
    stripe_checkout_cancel_url: str = ""

    paymob_enabled: bool = False
    paymob_secret_key: str = ""
    paymob_public_key: str = ""
    paymob_hmac_secret: str = ""
    paymob_card_payment_method_id: int = Field(default=0, ge=0)
    paymob_wallet_payment_method_id: int = Field(default=0, ge=0)
    paymob_currency: str = "EGP"
    paymob_base_url: str = "https://accept.paymob.com"
    paymob_unified_checkout_url: str = "https://accept.paymob.com/unifiedcheckout/"
    paymob_notification_url: str = ""
    paymob_redirection_url: str = ""
    paymob_timeout_seconds: float = Field(default=15.0, ge=1.0, le=60.0)

    algolia_app_id: str = ""
    algolia_api_key: str = ""
    algolia_search_key: str = ""
    algolia_index_name: str = "elitedom_products"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_messaging_service_sid: str = ""

    sendgrid_enabled: bool = False
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@elitedom.store"
    sendgrid_from_name: str = "Elitedom Store"

    zeptomail_enabled: bool = False
    zeptomail_api_key: str = ""
    zeptomail_api_url: str = "https://api.zeptomail.com/v1.1/email"
    zeptomail_from_email: str = "noreply@elitedom.store"
    zeptomail_from_name: str = "Elitedom Store"
    zeptomail_bounce_address: str = "bounce@elitedom.store"

    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_refresh_token: str = ""
    zoho_org_id: str = ""

    hedera_enabled: bool = False
    hedera_network: Literal["mainnet", "testnet"] = "testnet"
    hedera_operator_id: str = ""
    hedera_operator_key: str = ""
    hedera_topic_id: str = ""

    @field_validator("allowed_hosts")
    @classmethod
    def parse_allowed_hosts(cls, value: str) -> str:
        return value

    @field_validator("media_public_path")
    @classmethod
    def validate_media_public_path(cls, value: str) -> str:
        normalized = "/" + value.strip().strip("/")
        if normalized == "/":
            raise ValueError("MEDIA_PUBLIC_PATH must identify a non-root URL path.")
        return normalized

    @model_validator(mode="after")
    def validate_deployment_safety(self) -> Settings:
        if self.app_postgres_db == self.odoo_db:
            raise ValueError("APP_POSTGRES_DB must differ from ODOO_DB.")
        if self.otel_exporter_otlp_endpoint and not is_safe_service_url(
            self.otel_exporter_otlp_endpoint
        ):
            raise ValueError(
                "OTEL_EXPORTER_OTLP_ENDPOINT must be HTTPS or an internal service URL."
            )
        if self.media_storage_provider == "s3":
            if not self.s3_bucket.strip():
                raise ValueError("S3_BUCKET is required when MEDIA_STORAGE_PROVIDER=s3.")
            if not self.s3_region.strip():
                raise ValueError("S3_REGION is required when MEDIA_STORAGE_PROVIDER=s3.")
            if not self.media_cdn_base_url.strip():
                raise ValueError(
                    "MEDIA_CDN_BASE_URL is required when MEDIA_STORAGE_PROVIDER=s3."
                )
            if self.s3_endpoint_url and not is_safe_service_url(self.s3_endpoint_url):
                raise ValueError("S3_ENDPOINT_URL must be HTTPS or a safe internal URL.")
            if self.environment == "development":
                if not is_safe_service_url(self.media_cdn_base_url):
                    raise ValueError(
                        "MEDIA_CDN_BASE_URL must be HTTPS or a safe local URL."
                    )
            elif not is_https_url(self.media_cdn_base_url):
                raise ValueError("MEDIA_CDN_BASE_URL must use HTTPS outside development.")

        integration_errors: list[str] = []
        if self.odoo_sync_enabled:
            if not is_safe_service_url(self.odoo_url):
                integration_errors.append("ODOO_URL")
            if not self.odoo_db.strip():
                integration_errors.append("ODOO_DB")
            if not self.odoo_api_user.strip():
                integration_errors.append("ODOO_API_USER")
            if not is_secure_secret(self.odoo_api_key, minimum_length=16):
                integration_errors.append("ODOO_API_KEY")
        if self.odoo_webhooks_enabled and not is_secure_secret(self.odoo_webhook_secret):
            integration_errors.append("ODOO_WEBHOOK_SECRET")
        if self.paymob_enabled:
            if not is_secure_secret(self.paymob_secret_key, minimum_length=20):
                integration_errors.append("PAYMOB_SECRET_KEY")
            if not is_secure_secret(self.paymob_public_key, minimum_length=20):
                integration_errors.append("PAYMOB_PUBLIC_KEY")
            if not is_secure_secret(self.paymob_hmac_secret, minimum_length=32):
                integration_errors.append("PAYMOB_HMAC_SECRET")
            if self.paymob_card_payment_method_id <= 0:
                integration_errors.append("PAYMOB_CARD_PAYMENT_METHOD_ID")
            if self.paymob_wallet_payment_method_id <= 0:
                integration_errors.append("PAYMOB_WALLET_PAYMENT_METHOD_ID")
            if not is_https_url(self.paymob_base_url):
                integration_errors.append("PAYMOB_BASE_URL")
            if not is_https_url(self.paymob_unified_checkout_url):
                integration_errors.append("PAYMOB_UNIFIED_CHECKOUT_URL")
            if not is_https_url(self.paymob_notification_url):
                integration_errors.append("PAYMOB_NOTIFICATION_URL")
            if not is_https_url(self.paymob_redirection_url):
                integration_errors.append("PAYMOB_REDIRECTION_URL")
            if len(self.paymob_currency.strip()) != 3 or not self.paymob_currency.isalpha():
                integration_errors.append("PAYMOB_CURRENCY")
        if self.sendgrid_enabled and not is_secure_secret(
            self.sendgrid_api_key,
            minimum_length=20,
        ):
            integration_errors.append("SENDGRID_API_KEY")
        if self.zeptomail_enabled and not is_secure_secret(
            self.zeptomail_api_key,
            minimum_length=20,
        ):
            integration_errors.append("ZEPTOMAIL_API_KEY")
        if self.zeptomail_enabled and not is_https_url(self.zeptomail_api_url):
            integration_errors.append("ZEPTOMAIL_API_URL")
        if self.sentry_enabled:
            if not is_valid_sentry_dsn(self.sentry_dsn):
                integration_errors.append("SENTRY_DSN")
            if (
                self.environment in {"staging", "production"}
                and not self.sentry_release.strip()
            ):
                integration_errors.append("SENTRY_RELEASE")
        if integration_errors:
            raise ValueError(
                "Enabled integrations require valid, non-placeholder configuration for: "
                + ", ".join(integration_errors)
            )
        if self.hedera_enabled:
            raise ValueError(
                "HEDERA_ENABLED=true is unsupported until real HCS submission exists."
            )

        if self.environment not in {"staging", "production"}:
            return self
        if self.debug:
            raise ValueError("DEBUG must be false in staging and production.")
        if "*" in self.allowed_hosts.split(","):
            raise ValueError("ALLOWED_HOSTS must not contain '*' outside development.")
        if "*" in self.cors_origin_list:
            raise ValueError("CORS_ORIGINS must not contain '*' outside development.")
        if not self.staff_mfa_required:
            raise ValueError("STAFF_MFA_REQUIRED must be true in staging and production.")
        if self.rate_limit_backend != "redis":
            raise ValueError("RATE_LIMIT_BACKEND must be redis in staging and production.")
        if not self.trusted_proxy_ip_set:
            raise ValueError(
                "TRUSTED_PROXY_IPS must identify the trusted reverse proxy in staging and production."
            )
        required_secrets = {
            "SECRET_KEY": self.secret_key,
            "JWT_SECRET_KEY": self.jwt_secret_key,
            "POSTGRES_PASSWORD": self.postgres_password,
            "REDIS_PASSWORD": self.redis_password,
        }
        if self.metrics_enabled:
            required_secrets["METRICS_BEARER_TOKEN"] = self.metrics_bearer_token
        invalid = [
            name
            for name, value in required_secrets.items()
            if not is_secure_secret(value)
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
    return Settings()  # type: ignore[call-arg]

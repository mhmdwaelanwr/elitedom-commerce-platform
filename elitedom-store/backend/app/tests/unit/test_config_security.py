"""Deployment configuration must fail closed around secrets, URLs and CORS."""

import pytest
from pydantic import ValidationError

from app.config import (
    Settings,
    is_safe_service_url,
    is_secure_secret,
)


def _production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "debug": False,
        "secret_key": "a-secure-secret-key-value-with-32-or-more-characters",
        "jwt_secret_key": "another-secure-jwt-key-value-with-32-plus-chars",
        "postgres_password": "database-password-with-32-plus-characters",
        "redis_password": "redis-password-value-with-32-plus-characters",
        "allowed_hosts": "api.elitedom.store",
        "cors_origins": "https://elitedom.store",
        "staff_mfa_required": True,
        "rate_limit_backend": "redis",
        "metrics_enabled": True,
        "metrics_bearer_token": "metrics-bearer-token-value-with-32-plus-characters",
    }
    values.update(overrides)
    return Settings(**values)


def test_secure_secret_rejects_template_or_short_values() -> None:
    assert not is_secure_secret("")
    assert not is_secure_secret("CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING")
    assert not is_secure_secret("short-value")
    assert is_secure_secret("odoo-hmac-secret-value-with-32-plus-characters")


def test_internal_service_urls_allow_named_container_http_but_not_public_http() -> None:
    assert is_safe_service_url("http://odoo:8069")
    assert is_safe_service_url("http://fastapi:8000/api/v1/webhooks/odoo")
    assert is_safe_service_url("https://odoo.example.com")
    assert not is_safe_service_url("http://odoo.example.com")
    assert not is_safe_service_url("https://user:password@odoo.example.com")


def test_production_settings_require_distinct_generated_core_secrets() -> None:
    settings = _production_settings()
    assert settings.environment == "production"

    with pytest.raises(ValidationError, match="must be distinct"):
        _production_settings(
            jwt_secret_key="a-secure-secret-key-value-with-32-or-more-characters"
        )

    with pytest.raises(ValidationError, match="ALLOWED_HOSTS"):
        _production_settings(allowed_hosts="*")


def test_odoo_webhooks_require_explicit_enablement_and_a_real_secret() -> None:
    disabled = _production_settings(
        odoo_webhooks_enabled=False,
        odoo_webhook_secret="",
    )
    assert disabled.odoo_webhooks_enabled is False

    with pytest.raises(ValidationError, match="ODOO_WEBHOOK_SECRET"):
        _production_settings(
            odoo_webhooks_enabled=True,
            odoo_webhook_secret="CHANGE_ME_HMAC_SECRET",
        )

    enabled = _production_settings(
        odoo_webhooks_enabled=True,
        odoo_webhook_secret="odoo-hmac-secret-value-with-32-plus-characters",
    )
    assert enabled.odoo_webhooks_enabled is True


def test_odoo_outbound_sync_requires_all_credentials_and_a_safe_url() -> None:
    with pytest.raises(ValidationError, match="ODOO_API_KEY"):
        _production_settings(
            odoo_sync_enabled=True,
            odoo_api_key="CHANGE_ME",
        )

    with pytest.raises(ValidationError, match="ODOO_URL"):
        _production_settings(
            odoo_sync_enabled=True,
            odoo_url="http://public-odoo.example.com",
            odoo_api_key="odoo-api-key-value-with-16-plus-characters",
        )

    enabled = _production_settings(
        odoo_sync_enabled=True,
        odoo_url="http://odoo:8069",
        odoo_api_user="elitedom_api_user",
        odoo_api_key="odoo-api-key-value-with-16-plus-characters",
    )
    assert enabled.odoo_sync_enabled is True

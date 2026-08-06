"""Deployment configuration must fail closed around secrets and CORS."""

import pytest
from pydantic import ValidationError

from app.config import Settings, is_secure_secret


def _production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "debug": False,
        "secret_key": "a-secure-secret-key-value-with-32-or-more-characters",
        "jwt_secret_key": "another-secure-jwt-key-value-with-32-plus-chars",
        "postgres_password": "database-password-with-32-plus-characters",
        "redis_password": "redis-password-value-with-32-plus-characters",
        "odoo_webhook_secret": "odoo-hmac-secret-value-with-32-plus-characters",
        "allowed_hosts": "api.elitedom.store",
        "cors_origins": "https://elitedom.store",
    }
    values.update(overrides)
    return Settings(**values)


def test_secure_secret_rejects_template_or_short_values() -> None:
    assert not is_secure_secret("")
    assert not is_secure_secret("CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING")
    assert not is_secure_secret("short-value")
    assert is_secure_secret("odoo-hmac-secret-value-with-32-plus-characters")


def test_production_settings_require_distinct_generated_secrets() -> None:
    settings = _production_settings()
    assert settings.environment == "production"

    with pytest.raises(ValidationError, match="ODOO_WEBHOOK_SECRET"):
        _production_settings(odoo_webhook_secret="CHANGE_ME_HMAC_SECRET")

    with pytest.raises(ValidationError, match="must be distinct"):
        _production_settings(jwt_secret_key="a-secure-secret-key-value-with-32-or-more-characters")

    with pytest.raises(ValidationError, match="ALLOWED_HOSTS"):
        _production_settings(allowed_hosts="*")

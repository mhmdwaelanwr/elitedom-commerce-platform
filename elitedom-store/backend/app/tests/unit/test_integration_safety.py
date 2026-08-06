"""Incomplete integrations must fail closed instead of reporting fake success."""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.integrations.hedera import tasks as hedera_tasks
from app.integrations.sendgrid import tasks as sendgrid_tasks
from app.integrations.zeptomail import tasks as zeptomail_tasks


def _base_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "development",
        "debug": False,
        "secret_key": "test-secret-key-that-is-long-enough-for-validation",
        "jwt_secret_key": "test-jwt-secret-key-that-is-long-enough-for-validation",
        "postgres_password": "test-postgres-password",
    }
    values.update(overrides)
    return Settings(**values)


def test_enabled_email_providers_require_real_credentials() -> None:
    with pytest.raises(ValidationError, match="SENDGRID_API_KEY"):
        _base_settings(sendgrid_enabled=True, sendgrid_api_key="CHANGE_ME")

    with pytest.raises(ValidationError, match="ZEPTOMAIL_API_KEY"):
        _base_settings(zeptomail_enabled=True, zeptomail_api_key="CHANGE_ME")

    with pytest.raises(ValidationError, match="ZEPTOMAIL_API_URL"):
        _base_settings(
            zeptomail_enabled=True,
            zeptomail_api_key="z" * 32,
            zeptomail_api_url="http://api.zeptomail.com/v1.1/email",
        )


def test_hedera_cannot_be_enabled_until_real_submission_exists() -> None:
    with pytest.raises(ValidationError, match="HEDERA_ENABLED=true is unsupported"):
        _base_settings(hedera_enabled=True)


def test_disabled_hedera_returns_no_fake_transaction_id(monkeypatch) -> None:
    monkeypatch.setattr(
        hedera_tasks,
        "settings",
        SimpleNamespace(hedera_enabled=False),
    )

    result = hedera_tasks.hash_payment_to_hedera.run(
        "ORD-1001",
        1200.0,
        "EGP",
        "card",
        42,
    )

    assert result["status"] == "skipped"
    assert len(result["payload_hash"]) == 64
    assert "hedera_tx_id" not in result


def test_enabled_hedera_fails_loudly_without_fake_success(monkeypatch) -> None:
    monkeypatch.setattr(
        hedera_tasks,
        "settings",
        SimpleNamespace(hedera_enabled=True),
    )

    with pytest.raises(hedera_tasks.HederaIntegrationUnavailable):
        hedera_tasks.hash_payment_to_hedera.run(
            "ORD-1002",
            1250.0,
            "EGP",
            "card",
            43,
        )


def test_disabled_email_tasks_report_skipped(monkeypatch) -> None:
    monkeypatch.setattr(
        sendgrid_tasks,
        "settings",
        SimpleNamespace(sendgrid_enabled=False),
    )
    monkeypatch.setattr(
        zeptomail_tasks,
        "settings",
        SimpleNamespace(zeptomail_enabled=False),
    )

    sendgrid_result = sendgrid_tasks.send_invoice_email.run(
        "customer@example.com",
        "ORD-1003",
        "https://files.example.com/invoice.pdf",
    )
    zeptomail_result = zeptomail_tasks.send_transactional_email.run(
        "customer@example.com",
        "Order update",
        "<p>Your order has shipped.</p>",
    )

    assert sendgrid_result["status"] == "skipped"
    assert zeptomail_result["status"] == "skipped"


@pytest.mark.parametrize(
    "url",
    [
        "http://files.example.com/invoice.pdf",
        "https://user:password@files.example.com/invoice.pdf",
        "/relative/invoice.pdf",
    ],
)
def test_invoice_links_must_be_safe_https_urls(url: str) -> None:
    with pytest.raises(ValueError, match="absolute HTTPS URL"):
        sendgrid_tasks._validate_invoice_url(url)


def test_zeptomail_calls_the_official_send_endpoint(monkeypatch) -> None:
    class FakeResponse:
        status_code = 202
        content = b'{"request_id": "request-123"}'

        @staticmethod
        def raise_for_status() -> None:
            return None

        @staticmethod
        def json() -> dict[str, str]:
            return {"request_id": "request-123"}

    captured: dict[str, object] = {}

    def fake_post(url: str, **kwargs: object) -> FakeResponse:
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(
        zeptomail_tasks,
        "settings",
        SimpleNamespace(
            zeptomail_enabled=True,
            zeptomail_api_key="real-token",
            zeptomail_api_url="https://api.zeptomail.com/v1.1/email",
            zeptomail_from_email="noreply@elitedom.store",
            zeptomail_from_name="Elitedom Store",
        ),
    )
    monkeypatch.setattr(zeptomail_tasks.httpx, "post", fake_post)

    result = zeptomail_tasks.send_transactional_email.run(
        "customer@example.com",
        "Order update",
        "<p>Your order has shipped.</p>",
    )

    assert result["status"] == "accepted"
    assert result["request_id"] == "request-123"
    assert captured["url"] == "https://api.zeptomail.com/v1.1/email"
    headers = captured["headers"]
    assert isinstance(headers, dict)
    assert headers["Authorization"] == "zoho-enczapikey real-token"

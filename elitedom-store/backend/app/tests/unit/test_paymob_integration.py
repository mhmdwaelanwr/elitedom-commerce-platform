"""Unit contracts for the Paymob provider boundary."""

from decimal import Decimal
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from app.integrations.paymob.client import (
    PaymobClient,
    paymob_is_configured,
    to_minor_units,
    unified_checkout_url,
)
from app.integrations.paymob.hmac import (
    calculate_transaction_hmac,
    transaction_hmac_message,
    verify_transaction_hmac,
)
from app.shared.schemas import PaymentMethod


def _settings(**overrides):
    values = {
        "paymob_enabled": True,
        "paymob_secret_key": "sk_test_" + "a" * 40,
        "paymob_public_key": "pk_test_" + "b" * 40,
        "paymob_hmac_secret": "h" * 64,
        "paymob_card_payment_method_id": 101,
        "paymob_wallet_payment_method_id": 202,
        "paymob_currency": "EGP",
        "paymob_base_url": "https://accept.paymob.com",
        "paymob_unified_checkout_url": "https://accept.paymob.com/unifiedcheckout/",
        "paymob_notification_url": "https://api.elitedom.test/api/v1/webhooks/paymob/transaction",
        "paymob_redirection_url": "https://store.elitedom.test/checkout/payment-result",
        "paymob_timeout_seconds": 5.0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _callback_payload() -> dict:
    return {
        "amount_cents": 12345,
        "created_at": "2026-08-07T00:00:00.000000",
        "currency": "EGP",
        "error_occured": False,
        "has_parent_transaction": False,
        "id": 987654,
        "integration_id": 1234,
        "is_3d_secure": True,
        "is_auth": False,
        "is_capture": False,
        "is_refunded": False,
        "is_standalone_payment": True,
        "is_voided": False,
        "order": {"id": 555},
        "owner": 42,
        "pending": False,
        "source_data": {
            "pan": "2346",
            "sub_type": "MasterCard",
            "type": "card",
        },
        "success": True,
    }


def test_paymob_configuration_is_method_specific() -> None:
    settings = _settings()
    assert paymob_is_configured(settings, PaymentMethod.CREDIT_CARD) is True
    assert paymob_is_configured(settings, PaymentMethod.MOBILE_WALLET) is True
    assert (
        paymob_is_configured(
            _settings(paymob_wallet_payment_method_id=0),
            PaymentMethod.MOBILE_WALLET,
        )
        is False
    )


def test_minor_units_and_unified_checkout_url() -> None:
    assert to_minor_units(Decimal("123.45")) == 12345
    url = unified_checkout_url(
        "https://accept.paymob.com/unifiedcheckout/",
        "pk_public",
        "client secret/+",
    )
    query = parse_qs(urlsplit(url).query)
    assert query == {
        "publicKey": ["pk_public"],
        "clientSecret": ["client secret/+"],
    }


def test_transaction_hmac_uses_provider_field_order() -> None:
    payload = _callback_payload()
    assert transaction_hmac_message(payload) == (
        "123452026-08-07T00:00:00.000000EGPfalsefalse9876541234"
        "truefalsefalsefalsetruefalse55542false2346MasterCardcardtrue"
    )
    secret = "s" * 40
    expected = (
        "dd8e77a9215feb3ddf4ade1feaa4401066a5efb261cfe744a4b63f189a8edb19"
        "6d3d97ab06dbee85e9185f13136394e2ae92f1a437027862760ea80edbd78852"
    )
    assert calculate_transaction_hmac(payload, secret) == expected
    assert verify_transaction_hmac(payload, expected, secret) is True
    assert verify_transaction_hmac(payload, "0" * 128, secret) is False


@pytest.mark.asyncio
async def test_create_intention_uses_server_amount_and_provider_reference() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers["Authorization"]
        captured["payload"] = __import__("json").loads(request.content)
        return httpx.Response(
            201,
            json={
                "id": "pi_test_123",
                "client_secret": "secret_123",
                "intention_order_id": 9988,
                "special_reference": "SO-2026-ABC123",
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        intention = await PaymobClient(
            settings=_settings(),
            http_client=http_client,
        ).create_intention(
            amount=Decimal("123.45"),
            currency="EGP",
            payment_method=PaymentMethod.CREDIT_CARD,
            merchant_reference="SO-2026-ABC123",
            order_id=77,
            items=[
                {
                    "name": "Laptop",
                    "amount": 12345,
                    "description": "SKU-LAPTOP",
                    "quantity": 1,
                }
            ],
            billing_data={
                "first_name": "Test",
                "last_name": "Buyer",
                "email": "buyer@example.test",
                "phone_number": "+201012345678",
                "country": "EG",
            },
            customer={
                "first_name": "Test",
                "last_name": "Buyer",
                "email": "buyer@example.test",
            },
        )

    assert captured["authorization"].startswith("Token sk_test_")
    assert captured["payload"]["amount"] == 12345
    assert captured["payload"]["payment_methods"] == [101]
    assert captured["payload"]["special_reference"] == "SO-2026-ABC123"
    assert captured["payload"]["extras"] == {
        "order_id": "77",
        "order_number": "SO-2026-ABC123",
    }
    assert intention.id == "pi_test_123"
    assert intention.provider_order_id == "9988"
    assert parse_qs(urlsplit(intention.checkout_url).query) == {
        "publicKey": [_settings().paymob_public_key],
        "clientSecret": ["secret_123"],
    }
    assert "sk_test_" not in intention.checkout_url

"""Paymob checkout, HMAC callback, replay, and stock-safety tests."""

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.paymob import webhooks as paymob_webhooks
from app.integrations.paymob.client import PaymobIntention
from app.integrations.paymob.hmac import calculate_transaction_hmac
from app.models import Cart, OutboxEvent, Partner, ProductTemplate, SaleOrder
from app.modules.orders import service as order_service
from app.modules.payments.models import (
    PaymentAttempt,
    PaymentRefund,
    PaymentWebhookEvent,
)
from app.shared.exceptions import PaymentGatewayUnavailableError


def _paymob_settings() -> SimpleNamespace:
    return SimpleNamespace(
        paymob_enabled=True,
        paymob_secret_key="sk_test_" + "a" * 40,
        paymob_public_key="pk_test_" + "b" * 40,
        paymob_hmac_secret="h" * 64,
        paymob_card_payment_method_id=101,
        paymob_wallet_payment_method_id=202,
        paymob_currency="EGP",
        paymob_base_url="https://accept.paymob.com",
        paymob_unified_checkout_url="https://accept.paymob.com/unifiedcheckout/",
        paymob_notification_url=(
            "https://api.example.test/api/v1/webhooks/paymob/transaction"
        ),
        paymob_redirection_url="https://store.example.test/checkout/payment-result",
        paymob_timeout_seconds=5.0,
    )


async def _create_product(db: AsyncSession) -> ProductTemplate:
    product = ProductTemplate(
        name="Paymob Checkout GPU",
        sku="PAYMOB-CHECKOUT-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
    )
    db.add(product)
    await db.flush()
    return product


async def _add_guest_item(client: AsyncClient, product_id: int, session_id: str) -> None:
    response = await client.post(
        f"/api/v1/orders/cart/items?session_id={session_id}",
        json={"product_id": product_id, "quantity": 1},
    )
    assert response.status_code == 200


def _guest_checkout_payload(payment_method: str = "credit_card") -> dict[str, str]:
    return {
        "customer_name": "Paymob Guest",
        "customer_email": "paymob.guest@elitedom.store",
        "customer_mobile": "+201012345678",
        "shipping_address": "15 El Matareya Street, Cairo",
        "shipping_governorate": "Cairo",
        "payment_method": payment_method,
    }


def _patch_paymob_checkout(
    monkeypatch: pytest.MonkeyPatch,
    *,
    captured: dict[str, Any] | None = None,
    intention_id: str = "pi_paymob_test",
    provider_order_id: str = "9988",
) -> SimpleNamespace:
    settings = _paymob_settings()
    monkeypatch.setattr(
        order_service,
        "ensure_paymob_is_configured",
        lambda *, payment_method: settings,
    )

    async def create_intention(self: Any, **kwargs: Any) -> PaymobIntention:
        if captured is not None:
            captured.update(kwargs)
        return PaymobIntention(
            id=intention_id,
            client_secret="client_secret_test",
            checkout_url=(
                "https://accept.paymob.com/unifiedcheckout/"
                "?publicKey=pk_test&clientSecret=client_secret_test"
            ),
            provider_order_id=provider_order_id,
            special_reference=kwargs["merchant_reference"],
        )

    monkeypatch.setattr(order_service.PaymobClient, "create_intention", create_intention)
    monkeypatch.setattr(paymob_webhooks, "settings", settings)
    return settings


def _transaction(
    *,
    order: dict[str, Any],
    transaction_id: int,
    intention_id: str,
    provider_order_id: str,
    integration_id: int = 101,
    amount_cents: int = 701100,
    currency: str = "EGP",
    success: bool = True,
    pending: bool = False,
    error_occured: bool = False,
    is_refunded: bool = False,
    is_voided: bool = False,
) -> dict[str, Any]:
    return {
        "amount_cents": amount_cents,
        "created_at": "2026-08-07T00:00:00.000000",
        "currency": currency,
        "error_occured": error_occured,
        "has_parent_transaction": False,
        "id": transaction_id,
        "integration_id": integration_id,
        "is_3d_secure": True,
        "is_auth": False,
        "is_capture": False,
        "is_refunded": is_refunded,
        "is_standalone_payment": True,
        "is_voided": is_voided,
        "order": {
            "id": provider_order_id,
            "merchant_order_id": order["name"],
        },
        "owner": 42,
        "pending": pending,
        "source_data": {
            "pan": "2346",
            "sub_type": "MasterCard",
            "type": "card",
        },
        "success": success,
        "payment_key_claims": {
            "intention_id": intention_id,
            "extra": {
                "order_id": str(order["id"]),
                "order_number": order["name"],
            },
        },
        "data": {
            "message": "declined" if not success else "approved",
            "txn_response_code": "DECLINED" if not success else "APPROVED",
        },
    }


async def _deliver_callback(
    client: AsyncClient,
    settings: SimpleNamespace,
    transaction: dict[str, Any],
):
    signature = calculate_transaction_hmac(
        transaction,
        settings.paymob_hmac_secret,
    )
    return await client.post(
        f"/api/v1/webhooks/paymob/transaction?hmac={signature}",
        json={"type": "TRANSACTION", "obj": transaction},
    )


@pytest.mark.asyncio
async def test_electronic_checkout_requires_paymob_before_mutation(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "paymob-unconfigured")

    def unavailable(*, payment_method: Any) -> None:
        raise PaymentGatewayUnavailableError("Paymob is not configured.")

    monkeypatch.setattr(
        order_service,
        "ensure_paymob_is_configured",
        unavailable,
    )

    response = await client.post(
        "/api/v1/orders/checkout?session_id=paymob-unconfigured",
        json=_guest_checkout_payload(),
    )

    assert response.status_code == 503
    assert await db_session.scalar(select(func.count(SaleOrder.id))) == 0
    assert await db_session.scalar(select(func.count(Partner.id))) == 0
    assert await db_session.scalar(select(func.count(PaymentAttempt.id))) == 0
    cart = await db_session.scalar(
        select(Cart).where(Cart.session_id == "paymob-unconfigured")
    )
    assert cart is not None
    assert cart.is_active is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payment_method", "expected_integration_id"),
    [("credit_card", 101), ("mobile_wallet", 202)],
)
async def test_paymob_checkout_creates_attempt_and_reserves_stock(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    payment_method: str,
    expected_integration_id: int,
) -> None:
    product = await _create_product(db_session)
    session_id = f"paymob-create-{payment_method}"
    await _add_guest_item(client, product.id, session_id)
    captured: dict[str, Any] = {}
    _patch_paymob_checkout(monkeypatch, captured=captured)

    response = await client.post(
        f"/api/v1/orders/checkout?session_id={session_id}",
        json=_guest_checkout_payload(payment_method),
    )

    assert response.status_code == 201
    body = response.json()
    order = body["order"]
    assert body["payment_provider"] == "paymob"
    assert body["payment_attempt_id"]
    assert body["paymob_intention_id"] == "pi_paymob_test"
    assert body["stripe_session_id"] is None
    assert body["payment_gateway_url"].startswith(
        "https://accept.paymob.com/unifiedcheckout/"
    )
    assert order["state"] == "draft"
    assert order["payment_method"] == payment_method
    assert order["currency"] == "EGP"

    assert captured["amount"] == Decimal("7011.00")
    assert captured["currency"] == "EGP"
    assert captured["merchant_reference"] == order["name"]
    assert captured["order_id"] == order["id"]
    assert captured["items"][0]["amount"] == 600000
    assert captured["items"][-1]["amount"] == 101100

    attempt = await db_session.get(PaymentAttempt, body["payment_attempt_id"])
    assert attempt is not None
    assert attempt.provider == "paymob"
    assert attempt.payment_method == payment_method
    assert attempt.status == "pending"
    assert attempt.amount_minor == 701100
    assert attempt.provider_intention_id == "pi_paymob_test"
    assert attempt.provider_order_id == "9988"
    assert attempt.idempotency_key == f"paymob:{order['name']}:{payment_method}"

    expected_method_id = (
        _paymob_settings().paymob_card_payment_method_id
        if payment_method == "credit_card"
        else _paymob_settings().paymob_wallet_payment_method_id
    )
    assert expected_method_id == expected_integration_id
    await db_session.refresh(product)
    assert product.stock_qty == 3


@pytest.mark.asyncio
async def test_signed_success_callback_is_idempotent_and_confirms_order(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "paymob-success")
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        "/api/v1/orders/checkout?session_id=paymob-success",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    order = checkout.json()["order"]

    transaction = _transaction(
        order=order,
        transaction_id=7001,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
    )
    first = await _deliver_callback(client, settings, transaction)
    replay = await _deliver_callback(client, settings, transaction)

    assert first.status_code == 200
    assert first.json() == {"status": "processed"}
    assert replay.status_code == 200
    assert replay.json() == {"status": "duplicate"}

    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "paid"
    assert persisted_order.state == "sale"

    attempt = await db_session.scalar(
        select(PaymentAttempt).where(PaymentAttempt.order_id == order["id"])
    )
    assert attempt is not None
    assert attempt.status == "succeeded"
    assert attempt.provider_transaction_id == "7001"
    assert await db_session.scalar(select(func.count(PaymentWebhookEvent.id))) == 1
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(
                OutboxEvent.event_type == "PaymentSucceeded"
            )
        )
        == 1
    )
    await db_session.refresh(product)
    assert product.stock_qty == 3


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("amount_cents", "currency", "record_status"),
    [
        (701099, "EGP", "rejected_amount_mismatch"),
        (701100, "USD", "rejected_currency_mismatch"),
    ],
)
async def test_signed_success_callback_rejects_amount_or_currency_mismatch(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    amount_cents: int,
    currency: str,
    record_status: str,
) -> None:
    product = await _create_product(db_session)
    session_id = f"paymob-mismatch-{amount_cents}-{currency}"
    await _add_guest_item(client, product.id, session_id)
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        f"/api/v1/orders/checkout?session_id={session_id}",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    order = checkout.json()["order"]

    transaction = _transaction(
        order=order,
        transaction_id=7100 + amount_cents,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
        amount_cents=amount_cents,
        currency=currency,
    )
    response = await _deliver_callback(client, settings, transaction)

    assert response.status_code == 200
    assert response.json() == {"status": "rejected"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "pending"
    assert persisted_order.state == "draft"

    receipt = await db_session.scalar(
        select(PaymentWebhookEvent).where(
            PaymentWebhookEvent.provider_transaction_id
            == str(transaction["id"])
        )
    )
    assert receipt is not None
    assert receipt.processing_status == record_status
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(
                OutboxEvent.event_type == "PaymentSucceeded"
            )
        )
        == 0
    )


@pytest.mark.asyncio
async def test_signed_failure_callback_releases_reserved_stock_once(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "paymob-failure")
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        "/api/v1/orders/checkout?session_id=paymob-failure",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    order = checkout.json()["order"]

    transaction = _transaction(
        order=order,
        transaction_id=7201,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
        success=False,
        error_occured=True,
    )
    first = await _deliver_callback(client, settings, transaction)
    replay = await _deliver_callback(client, settings, transaction)

    assert first.json() == {"status": "processed"}
    assert replay.json() == {"status": "duplicate"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "failed"
    assert persisted_order.state == "cancel"
    assert persisted_order.stock_reservation_released is True
    await db_session.refresh(product)
    assert product.stock_qty == 4


@pytest.mark.asyncio
async def test_signed_refund_callback_completes_requested_refund(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "paymob-refund")
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        "/api/v1/orders/checkout?session_id=paymob-refund",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    body = checkout.json()
    order = body["order"]

    success_transaction = _transaction(
        order=order,
        transaction_id=7301,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
    )
    success = await _deliver_callback(client, settings, success_transaction)
    assert success.json() == {"status": "processed"}

    persisted_order = await db_session.get(SaleOrder, order["id"])
    attempt = await db_session.get(PaymentAttempt, body["payment_attempt_id"])
    assert persisted_order is not None
    assert attempt is not None
    persisted_order.payment_status = "refund_requested"
    refund = PaymentRefund(
        order_id=persisted_order.id,
        attempt_id=attempt.id,
        provider="paymob",
        amount_minor=attempt.amount_minor,
        currency=attempt.currency,
        status="requested",
        reason="Customer requested cancellation",
        idempotency_key=f"refund:{persisted_order.id}:full",
    )
    db_session.add(refund)
    await db_session.flush()

    refund_transaction = _transaction(
        order=order,
        transaction_id=7301,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
        is_refunded=True,
    )
    refund_transaction["refunded_transaction_id"] = "refund-7301"
    response = await _deliver_callback(client, settings, refund_transaction)

    assert response.status_code == 200
    assert response.json() == {"status": "processed"}
    await db_session.refresh(persisted_order)
    await db_session.refresh(attempt)
    await db_session.refresh(refund)
    assert persisted_order.payment_status == "refunded"
    assert attempt.status == "refunded"
    assert refund.status == "succeeded"
    assert refund.provider_refund_id == "refund-7301"
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(
                OutboxEvent.event_type == "PaymentRefunded"
            )
        )
        == 1
    )

"""Focused Stripe Checkout and verified-webhook integration tests."""

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.stripe import checkout as stripe_checkout
from app.integrations.stripe import webhooks as stripe_webhooks
from app.models import Cart, OutboxEvent, Partner, ProductTemplate, SaleOrder, StripeWebhookEvent


def _stripe_settings() -> SimpleNamespace:
    return SimpleNamespace(
        stripe_secret_key="sk_test_123456789",
        stripe_webhook_secret="whsec_test_123456789",
        stripe_currency="egp",
        stripe_checkout_success_url="https://store.example.test/checkout/success",
        stripe_checkout_cancel_url="https://store.example.test/checkout?payment=cancelled",
    )


async def _create_product(db: AsyncSession) -> ProductTemplate:
    product = ProductTemplate(
        name="Stripe Checkout GPU",
        sku="STRIPE-CHECKOUT-GPU-001",
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


def _guest_checkout_payload() -> dict[str, str]:
    return {
        "customer_name": "Stripe Guest",
        "customer_email": "stripe.guest@elitedom.store",
        "customer_mobile": "+201012345678",
        "shipping_address": "15 El Matareya Street, Cairo",
        "shipping_governorate": "Cairo",
        "payment_method": "credit_card",
    }


@pytest.mark.asyncio
async def test_credit_card_checkout_requires_real_stripe_configuration_before_mutation(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "stripe-unconfigured")
    monkeypatch.setattr(
        stripe_checkout,
        "get_settings",
        lambda: SimpleNamespace(
            stripe_secret_key="",
            stripe_webhook_secret="",
            stripe_currency="egp",
            stripe_checkout_success_url="",
            stripe_checkout_cancel_url="",
        ),
    )

    response = await client.post(
        "/api/v1/orders/checkout?session_id=stripe-unconfigured",
        json=_guest_checkout_payload(),
    )

    assert response.status_code == 503
    assert await db_session.scalar(select(func.count(SaleOrder.id))) == 0
    assert await db_session.scalar(select(func.count(Partner.id))) == 0
    cart = await db_session.scalar(select(Cart).where(Cart.session_id == "stripe-unconfigured"))
    assert cart is not None
    assert cart.is_active is True


@pytest.mark.asyncio
async def test_credit_card_checkout_creates_real_session_and_reserves_stock(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "stripe-create-session")
    monkeypatch.setattr(stripe_checkout, "get_settings", _stripe_settings)
    captured_request: dict[str, Any] = {}

    def create_session(**kwargs: Any) -> dict[str, str]:
        captured_request.update(kwargs)
        return {
            "id": "cs_test_created",
            "url": "https://checkout.stripe.com/c/pay/cs_test_created",
            "payment_intent": "pi_test_created",
        }

    monkeypatch.setattr(stripe_checkout.stripe.checkout.Session, "create", create_session)

    response = await client.post(
        "/api/v1/orders/checkout?session_id=stripe-create-session",
        json=_guest_checkout_payload(),
    )

    assert response.status_code == 201
    body = response.json()
    order = body["order"]
    assert body["payment_gateway_url"] == "https://checkout.stripe.com/c/pay/cs_test_created"
    assert body["stripe_session_id"] == "cs_test_created"
    assert order["state"] == "draft"
    assert captured_request["idempotency_key"] == f"ord-{order['name'].lower()}-stripe"
    assert captured_request["metadata"]["order_id"] == str(order["id"])
    assert captured_request["line_items"][0]["price_data"]["unit_amount"] == 600000
    assert captured_request["line_items"][-1]["price_data"]["unit_amount"] == 101100
    assert captured_request["success_url"].endswith("session_id={CHECKOUT_SESSION_ID}")

    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    assert persisted_order.stripe_session_id == "cs_test_created"
    assert persisted_order.stripe_payment_intent_id == "pi_test_created"
    await db_session.refresh(product)
    assert product.stock_qty == 3


@pytest.mark.asyncio
async def test_signed_success_webhook_is_idempotent_and_confirms_order(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "stripe-success")
    monkeypatch.setattr(stripe_checkout, "get_settings", _stripe_settings)
    monkeypatch.setattr(stripe_webhooks, "settings", _stripe_settings())
    monkeypatch.setattr(
        stripe_checkout.stripe.checkout.Session,
        "create",
        lambda **_: {
            "id": "cs_test_success",
            "url": "https://checkout.stripe.com/c/pay/cs_test_success",
            "payment_intent": "pi_test_success",
        },
    )
    checkout_response = await client.post(
        "/api/v1/orders/checkout?session_id=stripe-success",
        json=_guest_checkout_payload(),
    )
    assert checkout_response.status_code == 201
    order = checkout_response.json()["order"]

    stripe_event = {
        "id": "evt_test_success",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_success",
                "payment_intent": "pi_test_success",
                "metadata": {
                    "order_id": str(order["id"]),
                    "order_number": order["name"],
                },
                "payment_status": "paid",
                "amount_total": 701100,
                "currency": "egp",
            }
        },
    }
    monkeypatch.setattr(
        stripe_webhooks.stripe.Webhook,
        "construct_event",
        lambda **_: stripe_event,
    )

    headers = {"Stripe-Signature": "test-signature"}
    first_delivery = await client.post(
        "/api/v1/webhooks/payment/stripe-callback", content=b"{}", headers=headers
    )
    replay = await client.post(
        "/api/v1/webhooks/payment/stripe-callback", content=b"{}", headers=headers
    )

    assert first_delivery.status_code == 200
    assert first_delivery.json() == {"status": "processed"}
    assert replay.status_code == 200
    assert replay.json() == {"status": "duplicate"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "paid"
    assert persisted_order.state == "sale"
    assert persisted_order.stripe_session_id == "cs_test_success"
    assert persisted_order.stripe_payment_intent_id == "pi_test_success"
    assert await db_session.scalar(select(func.count(StripeWebhookEvent.id))) == 1
    await db_session.refresh(product)
    assert product.stock_qty == 3


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("event_type", "amount_field", "amount", "currency", "record_status"),
    [
        (
            "checkout.session.completed",
            "amount_total",
            701099,
            "egp",
            "rejected_amount_mismatch",
        ),
        (
            "payment_intent.succeeded",
            "amount_received",
            701100,
            "usd",
            "rejected_currency_mismatch",
        ),
    ],
)
async def test_signed_success_webhook_rejects_mismatched_paid_amount_or_currency(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    event_type: str,
    amount_field: str,
    amount: int,
    currency: str,
    record_status: str,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, f"stripe-mismatch-{amount_field}-{currency}")
    monkeypatch.setattr(stripe_checkout, "get_settings", _stripe_settings)
    monkeypatch.setattr(stripe_webhooks, "settings", _stripe_settings())
    monkeypatch.setattr(
        stripe_checkout.stripe.checkout.Session,
        "create",
        lambda **_: {
            "id": "cs_test_mismatch",
            "url": "https://checkout.stripe.com/c/pay/cs_test_mismatch",
            "payment_intent": "pi_test_mismatch",
        },
    )
    checkout_response = await client.post(
        f"/api/v1/orders/checkout?session_id=stripe-mismatch-{amount_field}-{currency}",
        json=_guest_checkout_payload(),
    )
    assert checkout_response.status_code == 201
    order = checkout_response.json()["order"]

    event_object: dict[str, Any] = {
        "metadata": {"order_id": str(order["id"]), "order_number": order["name"]},
        amount_field: amount,
        "currency": currency,
    }
    if event_type == "checkout.session.completed":
        event_object.update(
            {
                "id": "cs_test_mismatch",
                "payment_intent": "pi_test_mismatch",
                "payment_status": "paid",
            }
        )
    else:
        event_object["id"] = "pi_test_mismatch"

    monkeypatch.setattr(
        stripe_webhooks.stripe.Webhook,
        "construct_event",
        lambda **_: {
            "id": f"evt_test_mismatch_{amount_field}_{currency}",
            "type": event_type,
            "data": {"object": event_object},
        },
    )

    response = await client.post(
        "/api/v1/webhooks/payment/stripe-callback",
        content=b"{}",
        headers={"Stripe-Signature": "test-signature"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "rejected"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "pending"
    assert persisted_order.state == "draft"
    record = await db_session.scalar(
        select(StripeWebhookEvent).where(
            StripeWebhookEvent.stripe_event_id == f"evt_test_mismatch_{amount_field}_{currency}"
        )
    )
    assert record is not None
    assert record.processing_status == record_status
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(OutboxEvent.event_type == "PaymentSucceeded")
        )
        == 0
    )


@pytest.mark.asyncio
async def test_signed_failure_webhook_releases_reserved_stock_once(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "stripe-failure")
    monkeypatch.setattr(stripe_checkout, "get_settings", _stripe_settings)
    monkeypatch.setattr(stripe_webhooks, "settings", _stripe_settings())
    monkeypatch.setattr(
        stripe_checkout.stripe.checkout.Session,
        "create",
        lambda **_: {
            "id": "cs_test_failure",
            "url": "https://checkout.stripe.com/c/pay/cs_test_failure",
            "payment_intent": "pi_test_failure",
        },
    )
    checkout_response = await client.post(
        "/api/v1/orders/checkout?session_id=stripe-failure",
        json=_guest_checkout_payload(),
    )
    assert checkout_response.status_code == 201
    order = checkout_response.json()["order"]

    stripe_event = {
        "id": "evt_test_failure",
        "type": "payment_intent.payment_failed",
        "data": {
            "object": {
                "id": "pi_test_failure",
                "metadata": {
                    "order_id": str(order["id"]),
                    "order_number": order["name"],
                },
            }
        },
    }
    monkeypatch.setattr(
        stripe_webhooks.stripe.Webhook,
        "construct_event",
        lambda **_: stripe_event,
    )

    headers = {"Stripe-Signature": "test-signature"}
    first_delivery = await client.post(
        "/api/v1/webhooks/payment/stripe-callback", content=b"{}", headers=headers
    )
    replay = await client.post(
        "/api/v1/webhooks/payment/stripe-callback", content=b"{}", headers=headers
    )

    assert first_delivery.json() == {"status": "processed"}
    assert replay.json() == {"status": "duplicate"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "failed"
    assert persisted_order.state == "cancel"
    assert persisted_order.stock_reservation_released is True
    assert persisted_order.stripe_session_id == "cs_test_failure"
    assert persisted_order.stripe_payment_intent_id == "pi_test_failure"
    await db_session.refresh(product)
    assert product.stock_qty == 4

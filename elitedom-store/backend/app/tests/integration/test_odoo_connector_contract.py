"""Cross-boundary checkout/payment/Odoo connector contract coverage."""

from __future__ import annotations

import importlib.util
from decimal import Decimal
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.odoo import tasks as odoo_tasks
from app.integrations.stripe import checkout as stripe_checkout
from app.integrations.stripe import webhooks as stripe_webhooks
from app.middleware.webhook_signature import settings as webhook_settings
from app.models import (
    OutboxEvent,
    Partner,
    ProductTemplate,
    SaleOrder,
    SaleOrderLine,
    StockPicking,
)
from app.shared.outbox_tasks import ClaimedOutboxEvent, resolve_outbox_route


def _load_odoo_payload_helpers() -> ModuleType:
    addon_file = (
        Path(__file__).resolve().parents[4]
        / "odoo"
        / "addons"
        / "elitedom_connector"
        / "services"
        / "payloads.py"
    )
    spec = importlib.util.spec_from_file_location(
        "elitedom_odoo_contract_payloads",
        addon_file,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import Odoo contract helpers from {addon_file}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


payloads = _load_odoo_payload_helpers()


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
        name="Odoo E2E GPU",
        sku="ODOO-E2E-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
    )
    db.add(product)
    await db.flush()
    return product


async def _checkout_paid_order(
    client: AsyncClient,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[SaleOrder, ProductTemplate]:
    product = await _create_product(db)
    session_id = "odoo-e2e-checkout"
    add_item = await client.post(
        f"/api/v1/orders/cart/items?session_id={session_id}",
        json={"product_id": product.id, "quantity": 1},
    )
    assert add_item.status_code == 200

    monkeypatch.setattr(stripe_checkout, "get_settings", _stripe_settings)
    monkeypatch.setattr(stripe_webhooks, "settings", _stripe_settings())
    monkeypatch.setattr(
        stripe_checkout.stripe.checkout.Session,
        "create",
        lambda **_: {
            "id": "cs_odoo_e2e",
            "url": "https://checkout.stripe.com/c/pay/cs_odoo_e2e",
            "payment_intent": "pi_odoo_e2e",
        },
    )

    checkout = await client.post(
        f"/api/v1/orders/checkout?session_id={session_id}",
        json={
            "customer_name": "Odoo Contract Buyer",
            "customer_email": "odoo.contract@elitedom.store",
            "customer_mobile": "+201012345678",
            "shipping_address": "15 El Matareya Street, Cairo",
            "shipping_governorate": "Cairo",
            "payment_method": "credit_card",
        },
    )
    assert checkout.status_code == 201
    order_payload = checkout.json()["order"]

    stripe_event = {
        "id": "evt_odoo_e2e_paid",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_odoo_e2e",
                "payment_intent": "pi_odoo_e2e",
                "metadata": {
                    "order_id": str(order_payload["id"]),
                    "order_number": order_payload["name"],
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
    paid = await client.post(
        "/api/v1/webhooks/payment/stripe-callback",
        content=b"{}",
        headers={"Stripe-Signature": "test-signature"},
    )
    assert paid.status_code == 200
    assert paid.json() == {"status": "processed"}

    order = await db.get(SaleOrder, order_payload["id"])
    assert order is not None
    await db.refresh(order)
    await db.refresh(product)
    assert order.payment_status == "paid"
    assert order.state == "sale"
    assert product.stock_qty == 3
    return order, product


async def _order_snapshot(db: AsyncSession, order: SaleOrder) -> dict[str, Any]:
    partner = await db.get(Partner, order.partner_id)
    assert partner is not None
    lines = list(
        (
            await db.execute(
                select(SaleOrderLine).where(SaleOrderLine.order_id == order.id)
            )
        ).scalars()
    )
    snapshot_lines: list[dict[str, Any]] = []
    for line in lines:
        product = await db.get(ProductTemplate, line.product_id)
        assert product is not None
        snapshot_lines.append(
            {
                "sku": product.sku,
                "name": product.name,
                "quantity": line.quantity,
                "unit_price": float(line.unit_price),
                "discount_percent": float(line.discount_percent),
            }
        )

    return {
        "id": order.id,
        "name": order.name,
        "state": order.state,
        "payment_status": order.payment_status,
        "notes": order.notes,
        "partner": {
            "email": partner.email,
            "name": partner.name,
            "phone": partner.phone,
        },
        "lines": snapshot_lines,
    }


@pytest.mark.asyncio
async def test_paid_checkout_routes_to_odoo_and_accepts_addon_signed_callbacks(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Exercise the application path from checkout through Odoo callbacks."""
    order, product = await _checkout_paid_order(client, db_session, monkeypatch)

    payment_events = list(
        (
            await db_session.execute(
                select(OutboxEvent)
                .where(OutboxEvent.event_type == "PaymentSucceeded")
                .order_by(OutboxEvent.id.desc())
            )
        ).scalars()
    )
    payment_event = next(
        (
            event
            for event in payment_events
            if int(dict(event.payload).get("order_id", 0)) == order.id
        ),
        None,
    )
    assert payment_event is not None
    route = resolve_outbox_route(
        ClaimedOutboxEvent(
            id=payment_event.id,
            event_type=payment_event.event_type,
            source_context=payment_event.source_context,
            payload=dict(payment_event.payload),
            attempts=payment_event.attempts,
        )
    )
    assert route is not None
    assert route.task_name == "app.integrations.odoo.tasks.sync_order_to_odoo"
    assert route.args_from_payload(dict(payment_event.payload)) == (order.id,)

    snapshot = await _order_snapshot(db_session, order)
    captured: dict[str, Any] = {}
    monkeypatch.setattr(odoo_tasks, "_odoo_ready", lambda: True)
    monkeypatch.setattr(
        odoo_tasks,
        "_load_order_snapshot",
        lambda order_id: snapshot if order_id == order.id else None,
    )
    monkeypatch.setattr(
        odoo_tasks,
        "_persist_odoo_order_id",
        lambda order_id, remote_id: remote_id,
    )
    monkeypatch.setattr(
        odoo_tasks.odoo_client,
        "find_sale_order_by_reference",
        lambda _: None,
    )
    monkeypatch.setattr(
        odoo_tasks.odoo_client,
        "find_or_create_partner",
        lambda **_: 77,
    )
    monkeypatch.setattr(
        odoo_tasks.odoo_client,
        "find_product_by_sku",
        lambda sku: 88 if sku == product.sku else None,
    )

    def create_sale_order(values: dict[str, Any]) -> int:
        captured.update(values)
        return 99

    monkeypatch.setattr(
        odoo_tasks.odoo_client,
        "create_sale_order",
        create_sale_order,
    )
    monkeypatch.setattr(
        odoo_tasks.odoo_client,
        "confirm_sale_order",
        lambda remote_id: remote_id == 99,
    )

    sync_result = odoo_tasks.sync_order_to_odoo.run(order.id)
    assert sync_result == {
        "status": "synced",
        "order_id": order.id,
        "odoo_order_id": 99,
        "created": True,
        "confirmed": True,
    }
    assert captured["client_order_ref"] == order.name
    assert captured["partner_id"] == 77
    assert captured["order_line"][0][2]["product_id"] == 88
    assert captured["order_line"][0][2]["product_uom_qty"] == 1

    shipped_payload = payloads.order_status_payload(
        event_id="odoo-addon-shipped-001",
        order_reference=order.name,
        new_status="shipped",
        tracking_number="ARX-E2E-001",
        carrier="Aramex",
        picking_reference="WH/OUT/E2E/001",
        odoo_order_id=99,
        timestamp="2026-08-06T02:00:00Z",
    )
    shipped_body = payloads.canonical_json_bytes(shipped_payload)
    shipped_headers = {
        "X-Elitedom-Signature": payloads.sign_body(
            webhook_settings.odoo_webhook_secret,
            shipped_body,
        ),
        "X-Idempotency-Key": shipped_payload["event_id"],
    }
    shipped = await client.post(
        "/api/v1/webhooks/odoo/order-status",
        content=shipped_body,
        headers=shipped_headers,
    )
    duplicate = await client.post(
        "/api/v1/webhooks/odoo/order-status",
        content=shipped_body,
        headers=shipped_headers,
    )

    assert shipped.status_code == 200
    assert shipped.json()["status"] == "processed"
    assert shipped.json()["tracking_number"] == "ARX-E2E-001"
    assert duplicate.status_code == 200
    assert duplicate.json()["status"] == "duplicate"

    await db_session.refresh(order)
    picking = await db_session.scalar(
        select(StockPicking).where(StockPicking.sale_id == order.id)
    )
    assert order.odoo_order_id == 99
    assert picking is not None
    assert picking.courier_tracking_ref == "ARX-E2E-001"

    inventory_payload = payloads.inventory_payload(
        event_id="odoo-addon-inventory-001",
        product_sku=product.sku,
        new_quantity=12,
        warehouse_location="WH/Stock",
        timestamp="2026-08-06T02:05:00Z",
    )
    inventory_body = payloads.canonical_json_bytes(inventory_payload)
    inventory = await client.post(
        "/api/v1/webhooks/odoo/inventory",
        content=inventory_body,
        headers={
            "X-Elitedom-Signature": payloads.sign_body(
                webhook_settings.odoo_webhook_secret,
                inventory_body,
            ),
            "X-Idempotency-Key": inventory_payload["event_id"],
        },
    )
    assert inventory.status_code == 200
    assert inventory.json()["stock_qty"] == 12
    await db_session.refresh(product)
    assert product.stock_qty == 12


@pytest.mark.asyncio
async def test_addon_signature_fails_after_body_tampering(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    product = await _create_product(db_session)
    payload = payloads.inventory_payload(
        event_id="odoo-addon-tamper-001",
        product_sku=product.sku,
        new_quantity=5,
        timestamp="2026-08-06T02:10:00Z",
    )
    signed_body = payloads.canonical_json_bytes(payload)
    signature = payloads.sign_body(
        webhook_settings.odoo_webhook_secret,
        signed_body,
    )
    tampered_body = signed_body.replace(b'"new_quantity":5', b'"new_quantity":6')

    response = await client.post(
        "/api/v1/webhooks/odoo/inventory",
        content=tampered_body,
        headers={"X-Elitedom-Signature": signature},
    )

    assert response.status_code == 401
    await db_session.refresh(product)
    assert product.stock_qty == 4

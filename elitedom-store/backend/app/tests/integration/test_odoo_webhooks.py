"""Integration coverage for signed, trusted Odoo inbound webhooks."""

import hashlib
import hmac
import json
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.webhook_signature import settings as webhook_settings
from app.models import (
    OutboxEvent,
    Partner,
    ProductTemplate,
    SaleOrder,
    StockPicking,
    WebhookReceipt,
)
from app.shared.events import event_bus


def _signed_payload(payload: dict) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(
        webhook_settings.odoo_webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return body, {"X-Elitedom-Signature": signature}


async def _create_product(db: AsyncSession, sku: str = "ODOO-WEBHOOK-GPU-001") -> ProductTemplate:
    product = ProductTemplate(
        name="Odoo Webhook GPU",
        sku=sku,
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=2,
    )
    db.add(product)
    await db.flush()
    return product


async def _create_order(db: AsyncSession) -> SaleOrder:
    partner = Partner(
        name="Webhook Buyer",
        email="odoo.webhook.buyer@elitedom.store",
        phone="01012345678",
    )
    db.add(partner)
    await db.flush()

    order = SaleOrder(
        name="ED-ORD-ODOO-001",
        partner_id=partner.id,
        state="draft",
        payment_method="cod",
        payment_status="pending",
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        shipping_address="15 El Matareya Street, Cairo",
        shipping_governorate="Cairo",
    )
    db.add(order)
    await db.flush()
    return order


@pytest.mark.asyncio
async def test_inventory_webhook_verifies_signature_persists_stock_and_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    events = []

    async def on_inventory_updated(event) -> None:
        events.append(event)

    event_bus.subscribe("InventoryUpdated", on_inventory_updated)
    payload = {
        "event_id": "odoo-inventory-001",
        "product_sku": product.sku,
        "new_quantity": 17,
        "warehouse_location": "WH/Stock",
        "timestamp": "2026-08-06T09:30:00Z",
    }
    body, headers = _signed_payload(payload)
    try:
        response = await client.post(
            "/api/v1/webhooks/odoo/inventory", content=body, headers=headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "processed"
        assert response.json()["stock_qty"] == 17

        await db_session.refresh(product)
        assert product.stock_qty == 17
        assert len(events) == 1
        assert events[0].payload["previous_quantity"] == 2
        assert events[0].payload["new_quantity"] == 17

        duplicate_response = await client.post(
            "/api/v1/webhooks/odoo/inventory", content=body, headers=headers
        )
        assert duplicate_response.status_code == 200
        assert duplicate_response.json()["status"] == "duplicate"
        assert len(events) == 1

        receipt_count = await db_session.scalar(
            select(func.count(WebhookReceipt.id)).where(WebhookReceipt.source == "odoo")
        )
        assert receipt_count == 1
    finally:
        event_bus.unsubscribe("InventoryUpdated", on_inventory_updated)


@pytest.mark.asyncio
async def test_order_status_webhook_updates_order_and_picking_without_customer_auth(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _create_order(db_session)
    events = []

    async def on_order_shipped(event) -> None:
        events.append(event)

    event_bus.subscribe("OrderShipped", on_order_shipped)
    payload = {
        "event_id": "odoo-order-status-001",
        "order_reference": order.name,
        "new_status": "shipped",
        "tracking_number": "ARX-123456",
        "carrier": "Aramex",
        "odoo_order_id": 4242,
        "timestamp": "2026-08-06T10:00:00Z",
    }
    body, headers = _signed_payload(payload)
    try:
        # Deliberately no user Authorization header: the signed Odoo payload
        # is trusted at the integration boundary, not through customer ownership.
        response = await client.post(
            "/api/v1/webhooks/odoo/order-status", content=body, headers=headers
        )
        assert response.status_code == 200
        response_payload = response.json()
        assert response_payload["status"] == "processed"
        assert response_payload["order_state"] == "sale"
        assert response_payload["tracking_number"] == "ARX-123456"

        await db_session.refresh(order)
        assert order.state == "sale"
        assert order.odoo_order_id == 4242
        picking = await db_session.scalar(
            select(StockPicking).where(StockPicking.sale_id == order.id)
        )
        assert picking is not None
        assert picking.state == "done"
        assert picking.courier_tracking_ref == "ARX-123456"
        assert picking.completed_date is not None
        assert len(events) == 1
        assert events[0].payload["order_id"] == order.id
        assert events[0].payload["carrier"] == "Aramex"
    finally:
        event_bus.unsubscribe("OrderShipped", on_order_shipped)


@pytest.mark.asyncio
async def test_order_status_webhook_does_not_regress_delivered_order_for_late_confirmation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Distinct delayed webhooks are acknowledged but cannot reopen delivery."""
    order = await _create_order(db_session)
    delivered_body, delivered_headers = _signed_payload(
        {
            "event_id": "odoo-order-delivered-first",
            "order_reference": order.name,
            "new_status": "delivered",
            "tracking_number": "ARX-DELIVERED-001",
            "odoo_order_id": 4242,
            "timestamp": "2026-08-06T10:15:00Z",
        }
    )
    delivered = await client.post(
        "/api/v1/webhooks/odoo/order-status",
        content=delivered_body,
        headers=delivered_headers,
    )
    assert delivered.status_code == 200
    assert delivered.json()["status"] == "processed"

    stale_body, stale_headers = _signed_payload(
        {
            "event_id": "odoo-order-confirmed-delayed",
            "order_reference": order.name,
            "new_status": "confirmed",
            "tracking_number": "STALE-TRACKING-MUST-NOT-WIN",
            "odoo_order_id": 9999,
            "timestamp": "2026-08-06T10:00:00Z",
        }
    )
    stale = await client.post(
        "/api/v1/webhooks/odoo/order-status",
        content=stale_body,
        headers=stale_headers,
    )
    assert stale.status_code == 200
    assert stale.json() == {
        "status": "stale",
        "event_key": "event:odoo-order-confirmed-delayed",
        "order_reference": order.name,
        "order_state": "done",
        "picking_id": 1,
        "tracking_number": "ARX-DELIVERED-001",
        "changed": False,
    }

    # A retry of the stale delivery is idempotent too: it reuses its receipt,
    # performs no state mutation, and does not create another event.
    stale_retry = await client.post(
        "/api/v1/webhooks/odoo/order-status",
        content=stale_body,
        headers=stale_headers,
    )
    assert stale_retry.status_code == 200
    assert stale_retry.json()["status"] == "duplicate"

    await db_session.refresh(order)
    picking = await db_session.scalar(select(StockPicking).where(StockPicking.sale_id == order.id))
    assert picking is not None
    assert order.state == "done"
    assert order.odoo_order_id == 4242
    assert picking.state == "done"
    assert picking.courier_tracking_ref == "ARX-DELIVERED-001"

    receipt_count = await db_session.scalar(
        select(func.count(WebhookReceipt.id)).where(WebhookReceipt.source == "odoo")
    )
    assert receipt_count == 2
    emitted_types = list(
        (
            await db_session.execute(
                select(OutboxEvent.event_type).where(
                    OutboxEvent.event_type.in_(("OrderDelivered", "OrderConfirmed"))
                )
            )
        ).scalars()
    )
    assert emitted_types == ["OrderDelivered"]


@pytest.mark.asyncio
async def test_odoo_webhook_rejects_an_invalid_hmac_signature(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session, sku="ODOO-WEBHOOK-SIGNATURE-001")
    payload = {
        "event_id": "odoo-inventory-invalid-signature",
        "product_sku": product.sku,
        "new_quantity": 9,
        "timestamp": "2026-08-06T11:00:00Z",
    }
    body = json.dumps(payload).encode("utf-8")

    response = await client.post(
        "/api/v1/webhooks/odoo/inventory",
        content=body,
        headers={"X-Elitedom-Signature": "not-a-valid-signature"},
    )

    assert response.status_code == 401
    await db_session.refresh(product)
    assert product.stock_qty == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("insecure_secret", ["", "CHANGE_ME_HMAC_SECRET"])
async def test_odoo_webhook_fails_closed_when_signing_secret_is_not_provisioned(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, insecure_secret: str
) -> None:
    """Known template secrets must never authorize an inventory mutation."""
    monkeypatch.setattr(webhook_settings, "odoo_webhook_secret", insecure_secret)

    response = await client.post(
        "/api/v1/webhooks/odoo/inventory",
        content=b'{"event_id":"unsafe-secret","product_sku":"NOPE","new_quantity":1,"timestamp":"2026-08-06T11:00:00Z"}',
        headers={"X-Elitedom-Signature": "any-value"},
    )

    assert response.status_code == 503
    assert response.json()["detail"]["error_code"] == "ELITE_7003"

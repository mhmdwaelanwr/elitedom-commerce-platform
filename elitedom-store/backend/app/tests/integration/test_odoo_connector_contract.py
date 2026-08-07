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
from app.integrations.paymob import webhooks as paymob_webhooks
from app.integrations.paymob.client import PaymobIntention
from app.integrations.paymob.hmac import calculate_transaction_hmac
from app.middleware.webhook_signature import settings as webhook_settings
from app.models import (
    OutboxEvent,
    Partner,
    ProductTemplate,
    SaleOrder,
    SaleOrderLine,
    StockPicking,
)
from app.modules.orders import service as order_service
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

    paymob_settings = _paymob_settings()
    monkeypatch.setattr(
        order_service,
        "ensure_paymob_is_configured",
        lambda *, payment_method: paymob_settings,
    )
    monkeypatch.setattr(paymob_webhooks, "settings", paymob_settings)

    async def create_intention(self: Any, **kwargs: Any) -> PaymobIntention:
        return PaymobIntention(
            id="pi_odoo_e2e",
            client_secret="client_secret_odoo_e2e",
            checkout_url=(
                "https://accept.paymob.com/unifiedcheckout/"
                "?publicKey=pk_test&clientSecret=client_secret_odoo_e2e"
            ),
            provider_order_id="9988",
            special_reference=kwargs["merchant_reference"],
        )

    monkeypatch.setattr(
        order_service.PaymobClient,
        "create_intention",
        create_intention,
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
    checkout_payload = checkout.json()
    order_payload = checkout_payload["order"]
    assert checkout_payload["payment_provider"] == "paymob"
    assert checkout_payload["paymob_intention_id"] == "pi_odoo_e2e"

    transaction = {
        "amount_cents": 701100,
        "created_at": "2026-08-07T00:00:00.000000",
        "currency": "EGP",
        "error_occured": False,
        "has_parent_transaction": False,
        "id": 7001001,
        "integration_id": paymob_settings.paymob_card_payment_method_id,
        "is_3d_secure": True,
        "is_auth": False,
        "is_capture": False,
        "is_refunded": False,
        "is_standalone_payment": True,
        "is_voided": False,
        "order": {
            "id": "9988",
            "merchant_order_id": order_payload["name"],
        },
        "owner": 42,
        "pending": False,
        "source_data": {
            "pan": "2346",
            "sub_type": "MasterCard",
            "type": "card",
        },
        "success": True,
        "payment_key_claims": {
            "intention_id": "pi_odoo_e2e",
            "extra": {
                "order_id": str(order_payload["id"]),
                "order_number": order_payload["name"],
            },
        },
        "data": {
            "message": "approved",
            "txn_response_code": "APPROVED",
        },
    }
    signature = calculate_transaction_hmac(
        transaction,
        paymob_settings.paymob_hmac_secret,
    )
    paid = await client.post(
        f"/api/v1/webhooks/paymob/transaction?hmac={signature}",
        json={"type": "TRANSACTION", "obj": transaction},
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

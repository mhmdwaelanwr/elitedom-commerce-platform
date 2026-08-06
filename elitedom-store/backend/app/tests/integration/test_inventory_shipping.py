"""Focused API coverage for local inventory and fulfilment persistence."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import (
    Partner,
    ProductTemplate,
    SaleOrder,
    SaleOrderLine,
    StockLot,
    StockPicking,
)
from app.shared.security import get_current_user


async def _create_partner(db: AsyncSession, email: str, *, role: str = "customer") -> Partner:
    partner = Partner(
        name=email.split("@", maxsplit=1)[0],
        email=email,
        phone="01012345678",
        password_hash="not-used-in-route-tests",
        role=role,
    )
    db.add(partner)
    await db.flush()
    return partner


async def _create_product(db: AsyncSession, *, sku: str = "INV-GPU-001") -> ProductTemplate:
    product = ProductTemplate(
        name="Inventory GPU",
        sku=sku,
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
    )
    db.add(product)
    await db.flush()
    return product


async def _create_order(
    db: AsyncSession,
    partner: Partner,
    *,
    name: str,
    state: str = "sale",
) -> SaleOrder:
    order = SaleOrder(
        name=name,
        partner_id=partner.id,
        state=state,
        payment_method="cod",
        payment_status="paid",
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        shipping_address="15 El Matareya Street, Cairo",
        shipping_governorate="Cairo",
        is_dropship=False,
    )
    db.add(order)
    await db.flush()
    return order


@pytest.mark.asyncio
async def test_inventory_endpoints_return_persisted_data_and_enforce_adjustment_rbac(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    serial = StockLot(
        name="SN-INV-GPU-001",
        product_id=product.id,
        warranty_expiration_date=date.today() + timedelta(days=30),
    )
    db_session.add(serial)
    admin = await _create_partner(db_session, "inventory-admin@elitedom.store", role="system_admin")
    customer = await _create_partner(db_session, "inventory-customer@elitedom.store")

    async def admin_identity() -> dict:
        return {"user_id": admin.id, "email": admin.email, "role": "system_admin"}

    async def customer_identity() -> dict:
        return {"user_id": customer.id, "email": customer.email, "role": "customer"}

    app.dependency_overrides[get_current_user] = admin_identity
    try:
        stock = await client.get("/api/v1/inventory/inv-gpu-001")
        assert stock.status_code == 200
        assert stock.json() == {
            "sku": product.sku,
            "stock_qty": 4,
            "tracking": "serial",
            "is_available": True,
            "is_dropship": False,
        }

        serial_lookup = await client.get("/api/v1/inventory/serial/SN-INV-GPU-001")
        assert serial_lookup.status_code == 200
        assert serial_lookup.json()["sku"] == product.sku
        assert serial_lookup.json()["is_warranty_active"] is True

        scan = await client.get("/api/v1/inventory/scan?barcode=INV-GPU-001")
        assert scan.status_code == 200
        assert scan.json()["sku"] == product.sku
        assert scan.json()["warehouse_location"] is None

        adjustment = await client.post(
            "/api/v1/inventory/adjust",
            json={
                "sku": product.sku,
                "adjustment": 3,
                "reason": "Verified receipt from local warehouse",
            },
        )
        assert adjustment.status_code == 200
        assert adjustment.json() == {
            "sku": product.sku,
            "previous_stock_qty": 4,
            "quantity_delta": 3,
            "stock_qty": 7,
        }

        negative_adjustment = await client.post(
            "/api/v1/inventory/adjust",
            json={
                "sku": product.sku,
                "quantity_delta": -8,
                "reason": "Intentional invalid negative-stock test",
            },
        )
        assert negative_adjustment.status_code == 422
        await db_session.refresh(product)
        assert product.stock_qty == 7

        app.dependency_overrides[get_current_user] = customer_identity
        forbidden = await client.post(
            "/api/v1/inventory/adjust",
            json={
                "sku": product.sku,
                "quantity_delta": 1,
                "reason": "Customer cannot alter inventory",
            },
        )
        assert forbidden.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_shipping_dispatch_persists_one_picking_and_limits_tracking_visibility(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await _create_partner(db_session, "shipment-owner@elitedom.store")
    other_customer = await _create_partner(db_session, "shipment-other@elitedom.store")
    warehouse_operator = await _create_partner(
        db_session, "warehouse@elitedom.store", role="warehouse_operator"
    )
    order = await _create_order(db_session, owner, name="SO-SHIP-001")
    draft_order = await _create_order(db_session, owner, name="SO-SHIP-DRAFT", state="draft")
    sent_cod_order = await _create_order(db_session, owner, name="SO-SHIP-COD", state="sent")

    async def owner_identity() -> dict:
        return {"user_id": owner.id, "email": owner.email, "role": "customer"}

    async def other_customer_identity() -> dict:
        return {
            "user_id": other_customer.id,
            "email": other_customer.email,
            "role": "customer",
        }

    async def warehouse_identity() -> dict:
        return {
            "user_id": warehouse_operator.id,
            "email": warehouse_operator.email,
            "role": "warehouse_operator",
        }

    app.dependency_overrides[get_current_user] = owner_identity
    try:
        pending_tracking = await client.get(f"/api/v1/shipping/{order.id}/tracking")
        assert pending_tracking.status_code == 200
        assert pending_tracking.json()["status"] == "pending"
        assert pending_tracking.json()["tracking_number"] is None

        app.dependency_overrides[get_current_user] = other_customer_identity
        forbidden_tracking = await client.get(f"/api/v1/shipping/{order.id}/tracking")
        assert forbidden_tracking.status_code == 403

        app.dependency_overrides[get_current_user] = warehouse_identity
        invalid_dispatch = await client.post(
            f"/api/v1/shipping/{draft_order.id}/dispatch",
            json={"tracking_number": "EG-DRAFT-001", "reference": "DO-DRAFT-001"},
        )
        assert invalid_dispatch.status_code == 422

        sent_cod_dispatch = await client.post(
            f"/api/v1/shipping/{sent_cod_order.id}/dispatch",
            json={"tracking_number": "EG-COD-001", "reference": "DO-COD-001"},
        )
        assert sent_cod_dispatch.status_code == 200
        assert sent_cod_dispatch.json()["order_state"] == "done"

        dispatch = await client.post(
            f"/api/v1/shipping/{order.id}/dispatch",
            json={"tracking_number": "EG-SHIP-001", "reference": "DO-SHIP-001"},
        )
        assert dispatch.status_code == 200
        dispatched = dispatch.json()
        assert dispatched["order_state"] == "done"
        assert dispatched["picking_reference"] == "DO-SHIP-001"
        assert dispatched["picking_type"] == "outgoing"
        assert dispatched["picking_state"] == "done"

        updated_dispatch = await client.post(
            f"/api/v1/shipping/{order.id}/dispatch",
            json={
                "courier_tracking_ref": "EG-SHIP-002",
                "picking_reference": "DO-SHIP-001-UPDATED",
            },
        )
        assert updated_dispatch.status_code == 200
        assert updated_dispatch.json()["picking_id"] == dispatched["picking_id"]
        assert updated_dispatch.json()["tracking_number"] == "EG-SHIP-002"

        picking_count = await db_session.scalar(
            select(func.count(StockPicking.id)).where(StockPicking.sale_id == order.id)
        )
        assert picking_count == 1
        await db_session.refresh(order)
        assert order.state == "done"

        app.dependency_overrides[get_current_user] = owner_identity
        tracking = await client.get(f"/api/v1/shipping/{order.id}/tracking")
        assert tracking.status_code == 200
        assert tracking.json()["status"] == "dispatched"
        assert tracking.json()["tracking_number"] == "EG-SHIP-002"
        assert tracking.json()["picking_reference"] == "DO-SHIP-001-UPDATED"

        rate = await client.get("/api/v1/shipping/rates?governorate=Cairo&weight_kg=1")
        assert rate.status_code == 200
        assert rate.json()["shipping_fee"] == 150
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_dispatch_binds_recorded_serial_lots_without_inventing_missing_serials(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await _create_partner(db_session, "serial-owner@elitedom.store")
    warehouse_operator = await _create_partner(
        db_session, "serial-warehouse@elitedom.store", role="warehouse_operator"
    )
    serial_product = await _create_product(db_session, sku="SERIAL-DISPATCH-001")
    serial_order = await _create_order(db_session, owner, name="SO-SERIAL-001")
    missing_serial_order = await _create_order(db_session, owner, name="SO-SERIAL-MISSING")
    db_session.add_all(
        [
            SaleOrderLine(
                order_id=serial_order.id,
                product_id=serial_product.id,
                quantity=2,
                unit_price=serial_product.list_price,
                discount_percent=Decimal("0.00"),
                line_total=serial_product.list_price * 2,
            ),
            SaleOrderLine(
                order_id=missing_serial_order.id,
                product_id=serial_product.id,
                quantity=1,
                unit_price=serial_product.list_price,
                discount_percent=Decimal("0.00"),
                line_total=serial_product.list_price,
            ),
            StockLot(name="SN-DISPATCH-001", product_id=serial_product.id),
            StockLot(name="SN-DISPATCH-002", product_id=serial_product.id),
        ]
    )
    await db_session.flush()

    async def warehouse_identity() -> dict:
        return {
            "user_id": warehouse_operator.id,
            "email": warehouse_operator.email,
            "role": "warehouse_operator",
        }

    app.dependency_overrides[get_current_user] = warehouse_identity
    try:
        dispatched = await client.post(
            f"/api/v1/shipping/{serial_order.id}/dispatch",
            json={"tracking_number": "EG-SERIAL-001", "reference": "DO-SERIAL-001"},
        )
        assert dispatched.status_code == 200

        bound_lots = (
            (
                await db_session.execute(
                    select(StockLot)
                    .where(StockLot.sale_order_id == serial_order.id)
                    .order_by(StockLot.name)
                )
            )
            .scalars()
            .all()
        )
        assert [lot.name for lot in bound_lots] == ["SN-DISPATCH-001", "SN-DISPATCH-002"]

        missing_serials = await client.post(
            f"/api/v1/shipping/{missing_serial_order.id}/dispatch",
            json={
                "tracking_number": "EG-SERIAL-MISSING",
                "reference": "DO-SERIAL-MISSING",
            },
        )
        assert missing_serials.status_code == 409
        await db_session.refresh(missing_serial_order)
        assert missing_serial_order.state == "sale"
        missing_picking_count = await db_session.scalar(
            select(func.count(StockPicking.id)).where(
                StockPicking.sale_id == missing_serial_order.id
            )
        )
        assert missing_picking_count == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)

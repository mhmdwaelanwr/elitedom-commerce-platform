"""Integration coverage for the role-protected staff administration console."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import (
    B2BRFQ,
    Partner,
    ProductTemplate,
    RMATicket,
    SaleOrder,
    SaleOrderLine,
    StockPicking,
)
from app.shared.security import get_current_user


async def _partner(db: AsyncSession, email: str, *, role: str = "customer") -> Partner:
    partner = Partner(
        name=email.split("@", maxsplit=1)[0].replace(".", " ").title(),
        email=email,
        phone="01012345678",
        password_hash="not-used-by-route-tests",
        role=role,
        email_verified=True,
    )
    db.add(partner)
    await db.flush()
    return partner


async def _product(db: AsyncSession, *, sku: str, stock_qty: int) -> ProductTemplate:
    product = ProductTemplate(
        name=f"Admin {sku}",
        sku=sku,
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("25.00"),
        list_price=Decimal("6000.00"),
        stock_qty=stock_qty,
        tracking="barcode",
    )
    db.add(product)
    await db.flush()
    return product


async def _order(
    db: AsyncSession,
    customer: Partner,
    *,
    product: ProductTemplate,
    name: str,
    state: str = "sale",
    payment_status: str = "paid",
) -> SaleOrder:
    order = SaleOrder(
        name=name,
        partner_id=customer.id,
        state=state,
        payment_method="cod",
        payment_status=payment_status,
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        shipping_address="15 El Tahrir Street, Cairo",
        shipping_governorate="Cairo",
        is_dropship=False,
        created_at=datetime.now(UTC) - timedelta(hours=1),
    )
    db.add(order)
    await db.flush()
    db.add(
        SaleOrderLine(
            order_id=order.id,
            product_id=product.id,
            quantity=1,
            unit_price=product.list_price,
            discount_percent=Decimal("0.00"),
            line_total=product.list_price,
        )
    )
    await db.flush()
    return order


@pytest.mark.asyncio
async def test_admin_console_reads_persisted_operational_data_and_adjusts_stock(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    admin = await _partner(db_session, "admin@elitedom.store", role="system_admin")
    customer = await _partner(db_session, "customer@elitedom.store")
    b2b_customer = await _partner(db_session, "procurement@elitedom.store", role="b2b_client")
    low_stock_product = await _product(db_session, sku="ADMIN-LOW-001", stock_qty=2)
    healthy_product = await _product(db_session, sku="ADMIN-OK-001", stock_qty=12)
    paid_order = await _order(
        db_session,
        customer,
        product=low_stock_product,
        name="SO-ADMIN-PAID",
    )
    await _order(
        db_session,
        customer,
        product=healthy_product,
        name="SO-ADMIN-DRAFT",
        state="draft",
        payment_status="pending",
    )
    db_session.add(
        RMATicket(
            ticket_number="RMA-ADMIN-001",
            partner_id=customer.id,
            order_id=paid_order.id,
            product_id=low_stock_product.id,
            reason="The device loses connection during normal use.",
            evidence_media_url="https://evidence.example/rma-admin-001.mp4",
            status="pending_review",
        )
    )
    db_session.add(
        B2BRFQ(
            rfq_code="RFQ-ADMIN-001",
            partner_id=b2b_customer.id,
            items_payload={
                "schema_version": 1,
                "items": [
                    {
                        "product_id": healthy_product.id,
                        "quantity": 5,
                        "product_name": healthy_product.name,
                        "sku": healthy_product.sku,
                    }
                ],
            },
            status="submitted",
            total_estimated_value=Decimal("30000.00"),
        )
    )
    db_session.add(
        StockPicking(
            name="DO-ADMIN-001",
            sale_id=paid_order.id,
            picking_type="outgoing",
            state="assigned",
            courier_tracking_ref="EG-ADMIN-TRACK",
        )
    )
    await db_session.flush()

    async def admin_identity() -> dict:
        return {"user_id": admin.id, "email": admin.email, "role": "system_admin"}

    app.dependency_overrides[get_current_user] = admin_identity
    try:
        dashboard = await client.get("/api/v1/admin/dashboard")
        assert dashboard.status_code == 200
        metrics = dashboard.json()["metrics"]
        assert metrics["total_customers"] == 2
        assert metrics["total_orders"] == 2
        assert metrics["paid_revenue"] == "7011.00"
        assert metrics["low_stock_products"] == 1
        assert metrics["pending_rma_claims"] == 1
        assert metrics["active_rfqs"] == 1
        assert len(dashboard.json()["revenue_trend"]) == 7

        orders = await client.get("/api/v1/admin/orders?q=ADMIN-PAID")
        assert orders.status_code == 200
        assert orders.json()["total_count"] == 1
        assert orders.json()["orders"][0]["customer_email"] == customer.email

        order_detail = await client.get(f"/api/v1/admin/orders/{paid_order.id}")
        assert order_detail.status_code == 200
        assert order_detail.json()["order_lines"][0]["sku"] == low_stock_product.sku
        assert "15 El Tahrir Street" in order_detail.json()["shipping_address"]

        products = await client.get("/api/v1/admin/products?low_stock=true")
        assert products.status_code == 200
        assert [item["sku"] for item in products.json()["products"]] == [low_stock_product.sku]
        assert products.json()["products"][0]["stock_health"] == "low_stock"

        adjustment = await client.post(
            f"/api/v1/admin/products/{low_stock_product.id}/stock-adjustments",
            json={"quantity_delta": 4, "reason": "Verified local warehouse receipt"},
        )
        assert adjustment.status_code == 200
        assert adjustment.json()["previous_stock_qty"] == 2
        assert adjustment.json()["stock_qty"] == 6

        customers = await client.get("/api/v1/admin/customers?q=customer")
        assert customers.status_code == 200
        assert customers.json()["customers"][0]["order_count"] == 2
        assert customers.json()["customers"][0]["lifetime_value"] == "14022.00"

        rmas = await client.get("/api/v1/admin/rma?status=pending_review")
        assert rmas.status_code == 200
        assert rmas.json()["claims"][0]["order_number"] == paid_order.name
        reviewed = await client.put(
            "/api/v1/admin/rma/RMA-ADMIN-001/review",
            json={"status": "approved", "resolution_notes": "Verified for return intake."},
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "approved"
        assert reviewed.json()["resolved_by"] == admin.id

        rfqs = await client.get("/api/v1/admin/rfqs")
        assert rfqs.status_code == 200
        assert rfqs.json()["rfqs"][0]["rfq_code"] == "RFQ-ADMIN-001"
        assert rfqs.json()["rfqs"][0]["item_count"] == 1
        quote = await client.put(
            "/api/v1/admin/rfqs/RFQ-ADMIN-001/quote",
            json={
                "validity_date": (datetime.now(UTC) + timedelta(days=7)).date().isoformat(),
                "terms": "Delivery after stock confirmation.",
            },
        )
        assert quote.status_code == 200
        assert quote.json()["status"] == "quoted"

        shipments = await client.get("/api/v1/admin/shipments?q=ADMIN-PAID")
        assert shipments.status_code == 200
        assert shipments.json()["shipments"][0]["tracking_number"] == "EG-ADMIN-TRACK"
        assert shipments.json()["shipments"][0]["customer_name"] == customer.name
        dispatch = await client.post(
            f"/api/v1/admin/shipments/{paid_order.id}/dispatch",
            json={"tracking_number": "EG-ADMIN-DISPATCHED", "reference": "DO-ADMIN-001"},
        )
        assert dispatch.status_code == 200
        assert dispatch.json()["order_state"] == "done"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_customer_jwt_cannot_access_any_admin_data(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _partner(db_session, "not-staff@elitedom.store")

    async def customer_identity() -> dict:
        return {"user_id": customer.id, "email": customer.email, "role": "customer"}

    app.dependency_overrides[get_current_user] = customer_identity
    try:
        for path in (
            "/api/v1/admin/dashboard",
            "/api/v1/admin/orders",
            "/api/v1/admin/customers",
            "/api/v1/admin/rma",
        ):
            response = await client.get(path)
            assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

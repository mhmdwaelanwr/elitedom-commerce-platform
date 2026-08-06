"""Hybrid dropship coverage: vetted supplier routing after payment only."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.stripe.webhooks import process_stripe_event
from app.models import (
    OutboxEvent,
    Partner,
    ProductTemplate,
    PurchaseOrder,
    SaleOrder,
    SaleOrderLine,
    Supplier,
)
from app.modules.suppliers.dropship import (
    DropshipFulfillmentService,
    ProductSupplierService,
)
from app.modules.suppliers.schemas import ProductSupplierUpsertRequest
from app.shared.exceptions import ResourceConflictError


@pytest.mark.asyncio
async def test_paid_dropship_order_creates_one_verified_supplier_po_and_outbox_event(
    db_session: AsyncSession,
) -> None:
    product = ProductTemplate(
        name="Dropship GPU",
        sku="DS-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=0,
        is_dropship_enabled=True,
    )
    supplier = Supplier(
        name="Verified Dropship Distributor",
        email="vendor@example.test",
        phone="01000000000",
        is_active=True,
        is_verified=False,
        lead_time_days=4,
    )
    customer = Partner(
        name="Dropship Customer",
        email="customer@example.test",
        phone="01011111111",
    )
    db_session.add_all([product, supplier, customer])
    await db_session.flush()

    link_service = ProductSupplierService(db_session)
    mapping = ProductSupplierUpsertRequest(
        supplier_sku="VENDOR-DS-GPU-001",
        unit_cost_usd=Decimal("125.00"),
        lead_time_days=2,
        is_primary=True,
    )
    with pytest.raises(ResourceConflictError):
        await link_service.upsert_product_supplier(
            supplier_id=supplier.id,
            product_id=product.id,
            request=mapping,
        )

    supplier.is_verified = True
    await db_session.flush()
    linked = await link_service.upsert_product_supplier(
        supplier_id=supplier.id,
        product_id=product.id,
        request=mapping,
    )
    assert linked.is_primary is True

    order = SaleOrder(
        name="SO-DS-PAID-001",
        partner_id=customer.id,
        state="draft",
        payment_method="credit_card",
        payment_status="pending",
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        shipping_address="Private customer address must not enter the outbox",
        shipping_governorate="Cairo",
        is_dropship=True,
        stripe_session_id="cs_dropship_paid",
        stripe_payment_intent_id="pi_dropship_paid",
    )
    db_session.add(order)
    await db_session.flush()
    db_session.add(
        SaleOrderLine(
            order_id=order.id,
            product_id=product.id,
            quantity=2,
            unit_price=Decimal("6000.00"),
            discount_percent=Decimal("0.00"),
            line_total=Decimal("12000.00"),
        )
    )
    await db_session.flush()

    # The same service is harmless before the payment transition.
    assert (
        await DropshipFulfillmentService(db_session).ensure_purchase_orders_for_paid_order(order.id)
        == []
    )
    assert await db_session.scalar(select(func.count(PurchaseOrder.id))) == 0

    result = await process_stripe_event(
        db=db_session,
        event_id="evt_dropship_paid_1",
        event_type="checkout.session.completed",
        event_data={
            "id": "cs_dropship_paid",
            "payment_intent": "pi_dropship_paid",
            "metadata": {"order_id": str(order.id), "order_number": order.name},
            "payment_status": "paid",
            "amount_total": 701100,
            "currency": "egp",
        },
    )
    assert result.status == "processed"

    purchase_orders = (
        (await db_session.execute(select(PurchaseOrder).order_by(PurchaseOrder.id))).scalars().all()
    )
    assert len(purchase_orders) == 1
    purchase_order = purchase_orders[0]
    assert purchase_order.supplier_id == supplier.id
    assert purchase_order.sale_order_id == order.id
    assert purchase_order.status == "draft"
    assert purchase_order.fulfillment_key == f"dropship:{order.id}:{supplier.id}"
    assert purchase_order.items_payload == {
        "schema_version": 1,
        "items": [
            {
                "product_id": product.id,
                "sku": product.sku,
                "supplier_sku": "VENDOR-DS-GPU-001",
                "quantity": 2,
                "unit_cost": "125.00",
                "line_total": "250.00",
            }
        ],
    }

    dropship_event = await db_session.scalar(
        select(OutboxEvent).where(OutboxEvent.event_type == "DropshipFulfillmentRequested")
    )
    assert dropship_event is not None
    assert dropship_event.payload == {
        "line_count": 1,
        "order_id": order.id,
        "po_number": purchase_order.po_number,
        "purchase_order_id": purchase_order.id,
        "supplier_id": supplier.id,
    }
    assert "shipping_address" not in dropship_event.payload
    assert "email" not in dropship_event.payload
    assert "phone" not in dropship_event.payload

    # A distinct provider retry reaching an already-paid order must not create
    # a second PO or a duplicate dropship fulfillment request.
    retry = await process_stripe_event(
        db=db_session,
        event_id="evt_dropship_paid_2",
        event_type="payment_intent.succeeded",
        event_data={
            "id": "pi_dropship_paid",
            "metadata": {"order_id": str(order.id), "order_number": order.name},
            "amount_received": 701100,
            "currency": "egp",
        },
    )
    assert retry.status == "already_processed"
    assert await db_session.scalar(select(func.count(PurchaseOrder.id))) == 1
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(
                OutboxEvent.event_type == "DropshipFulfillmentRequested"
            )
        )
        == 1
    )

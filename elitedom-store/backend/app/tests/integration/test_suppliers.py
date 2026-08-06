"""Supplier procurement and goods-receipt workflow coverage."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent, ProductTemplate
from app.modules.suppliers.schemas import (
    PurchaseOrderCreateRequest,
    PurchaseOrderItemRequest,
    PurchaseOrderUpdateRequest,
    SupplierCreateRequest,
)
from app.modules.suppliers.service import SupplierService
from app.shared.exceptions import ResourceConflictError
from app.shared.outbox import OUTBOX_PENDING
from app.shared.outbox_tasks import ClaimedOutboxEvent, resolve_outbox_route


async def _product(db: AsyncSession) -> ProductTemplate:
    product = ProductTemplate(
        name="Supplier Test GPU",
        sku="SUP-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=2,
    )
    db.add(product)
    await db.flush()
    return product


@pytest.mark.asyncio
async def test_receiving_a_purchase_order_increases_stock_once(
    db_session: AsyncSession,
) -> None:
    product = await _product(db_session)
    service = SupplierService(db_session)
    supplier = await service.create_supplier(
        SupplierCreateRequest(
            name="Elitedom Distribution",
            email="supply@example.com",
            lead_time_days=3,
        )
    )
    purchase_order = await service.create_purchase_order(
        PurchaseOrderCreateRequest(
            supplier_id=supplier.id,
            items=[PurchaseOrderItemRequest(product_id=product.id, quantity=5)],
        )
    )
    assert purchase_order.status == "draft"
    assert purchase_order.total_amount == Decimal("500.00")

    sent = await service.update_purchase_order(
        purchase_order.po_number,
        PurchaseOrderUpdateRequest(status="sent"),
    )
    assert sent.status == "sent"
    received = await service.update_purchase_order(
        purchase_order.po_number,
        PurchaseOrderUpdateRequest(status="received"),
    )
    assert received.status == "received"
    assert product.stock_qty == 7

    inventory_events = list(
        (
            await db_session.execute(
                select(OutboxEvent).where(OutboxEvent.event_type == "InventoryUpdated")
            )
        ).scalars()
    )
    assert len(inventory_events) == 1
    inventory_event = inventory_events[0]
    assert inventory_event.status == OUTBOX_PENDING
    assert inventory_event.source_context == "supplier_receipt"
    assert inventory_event.payload == {
        "new_quantity": 7,
        "previous_quantity": 2,
        "product_id": product.id,
        "purchase_order_number": purchase_order.po_number,
        "quantity_delta": 5,
        "reason": f"Purchase order {purchase_order.po_number} received",
        "sku": product.sku,
    }
    route = resolve_outbox_route(
        ClaimedOutboxEvent(
            id=inventory_event.id,
            event_type=inventory_event.event_type,
            source_context=inventory_event.source_context,
            payload=inventory_event.payload,
            attempts=1,
        )
    )
    assert route is not None
    assert route.task_name == "app.integrations.algolia.tasks.index_product"
    assert route.args_from_payload(inventory_event.payload) == (product.id,)

    with pytest.raises(ResourceConflictError):
        await service.update_purchase_order(
            purchase_order.po_number,
            PurchaseOrderUpdateRequest(status="received"),
        )
    assert product.stock_qty == 7
    post_retry_event_count = await db_session.scalar(
        select(func.count(OutboxEvent.id)).where(OutboxEvent.event_type == "InventoryUpdated")
    )
    assert post_retry_event_count == 1

    performance = await service.supplier_performance(supplier.id)
    assert performance.total_purchase_orders == 1
    assert performance.received_purchase_orders == 1
    assert performance.on_time_delivery_rate_percent == Decimal("100.00")

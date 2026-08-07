"""Stage 6 inventory, cancellation, shipping, and dropship lifecycle coverage."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Partner,
    ProductSupplier,
    ProductTemplate,
    PurchaseOrder,
    SaleOrder,
    SaleOrderLine,
    Supplier,
)
from app.modules.fulfillment.cancellation import OrderCancellationService
from app.modules.fulfillment.models import (
    InventoryReservation,
    InventorySourceBalance,
    OrderFulfillment,
    Shipment,
)
from app.modules.fulfillment.service import CONFIRMED, FulfillmentLifecycleService
from app.modules.inventory.reservations import (
    CONSUMED,
    CONSUMED_PENDING_SOURCE,
    RELEASED,
    RESERVED,
    InventoryReservationService,
)
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.transitions import mark_payment_succeeded
from app.modules.shipping.service import DispatchOrderRequest, ShippingService
from app.modules.suppliers.dropship import DropshipFulfillmentService
from app.modules.suppliers.schemas import PurchaseOrderUpdateRequest
from app.modules.suppliers.service import SupplierService
from app.shared.exceptions import InsufficientStockError


async def _partner(db: AsyncSession, suffix: str) -> Partner:
    partner = Partner(
        name=f"Stage 6 {suffix}",
        email=f"stage6-{suffix}@elitedom.store",
        phone=f"0100000{len(suffix):04d}",
        password_hash="test-only",
        role="customer",
    )
    db.add(partner)
    await db.flush()
    return partner


async def _product(
    db: AsyncSession,
    suffix: str,
    *,
    stock_qty: int,
    dropship: bool = False,
) -> ProductTemplate:
    product = ProductTemplate(
        name=f"Stage 6 Product {suffix}",
        sku=f"ST6-{suffix.upper()}",
        tracking="barcode",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=stock_qty,
        is_dropship_enabled=dropship,
    )
    db.add(product)
    await db.flush()
    return product


async def _order(
    db: AsyncSession,
    partner: Partner,
    suffix: str,
    *,
    state: str = "sale",
    payment_status: str = "paid",
    payment_method: str = "credit_card",
    is_dropship: bool = False,
) -> SaleOrder:
    order = SaleOrder(
        name=f"SO-ST6-{suffix.upper()}",
        partner_id=partner.id,
        state=state,
        payment_method=payment_method,
        payment_status=payment_status,
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        currency="EGP",
        shipping_address="15 Stage Six Street, Cairo",
        shipping_governorate="Cairo",
        is_dropship=is_dropship,
    )
    db.add(order)
    await db.flush()
    return order


async def _line(
    db: AsyncSession,
    order: SaleOrder,
    product: ProductTemplate,
    quantity: int,
) -> SaleOrderLine:
    line = SaleOrderLine(
        order_id=order.id,
        product_id=product.id,
        quantity=quantity,
        unit_price=product.list_price,
        discount_percent=Decimal("0.00"),
        line_total=product.list_price * quantity,
    )
    db.add(line)
    await db.flush()
    return line


@pytest.mark.asyncio
async def test_competing_reservations_use_database_stock_guard(
    db_session: AsyncSession,
) -> None:
    """Two contenders that both want the last unit cannot both reserve it."""
    partner = await _partner(db_session, "contention")
    product = await _product(db_session, "contention", stock_qty=1)
    first_order = await _order(db_session, partner, "contention-a")
    second_order = await _order(db_session, partner, "contention-b")
    service = InventoryReservationService(db_session)

    # Both attempts target the same stock row.  The service uses a conditional
    # UPDATE (stock_qty >= quantity), not a stale Python-side availability check.
    await service.reserve_checkout_stock(
        order_id=first_order.id,
        products_by_id={product.id: product},
        requested_quantities={product.id: 1},
    )
    with pytest.raises(InsufficientStockError):
        await service.reserve_checkout_stock(
            order_id=second_order.id,
            products_by_id={product.id: product},
            requested_quantities={product.id: 1},
        )

    await db_session.refresh(product)
    assert product.stock_qty == 0
    reservations = await db_session.scalar(
        select(func.count(InventoryReservation.id)).where(
            InventoryReservation.product_id == product.id,
            InventoryReservation.status == RESERVED,
        )
    )
    assert reservations == 1


@pytest.mark.asyncio
async def test_odoo_absolute_snapshot_preserves_reserved_and_reconciles_shipped_units(
    db_session: AsyncSession,
) -> None:
    partner = await _partner(db_session, "source-sync")
    product = await _product(db_session, "source-sync", stock_qty=3)
    order = await _order(db_session, partner, "source-sync")
    await _line(db_session, order, product, 2)
    db_session.add_all(
        [
            InventorySourceBalance(
                product_id=product.id,
                source_on_hand_qty=5,
                source="test_baseline",
            ),
            InventoryReservation(
                order_id=order.id,
                product_id=product.id,
                quantity=2,
                status=RESERVED,
            ),
        ]
    )
    await db_session.flush()
    service = InventoryReservationService(db_session)

    previous, available = await service.apply_authoritative_quantity(
        product=product,
        source_quantity=5,
        source="odoo_test",
    )
    assert (previous, available) == (3, 3)

    assert await service.mark_order_consumed(order.id) == 2
    reservation = await db_session.scalar(
        select(InventoryReservation).where(InventoryReservation.order_id == order.id)
    )
    assert reservation is not None
    assert reservation.status == CONSUMED_PENDING_SOURCE

    _, available_after_source_catches_up = await service.apply_authoritative_quantity(
        product=product,
        source_quantity=3,
        source="odoo_test",
    )
    assert available_after_source_catches_up == 3
    assert reservation.status == CONSUMED
    assert reservation.source_reconciled_quantity == 2


@pytest.mark.asyncio
async def test_paid_cancellation_releases_once_and_creates_one_refund_request(
    db_session: AsyncSession,
) -> None:
    partner = await _partner(db_session, "cancel")
    product = await _product(db_session, "cancel", stock_qty=3)
    order = await _order(db_session, partner, "cancel")
    await _line(db_session, order, product, 2)
    db_session.add(
        InventoryReservation(
            order_id=order.id,
            product_id=product.id,
            quantity=2,
            status=RESERVED,
        )
    )
    db_session.add(
        InventorySourceBalance(
            product_id=product.id,
            source_on_hand_qty=5,
            source="test_baseline",
        )
    )
    db_session.add(
        OrderFulfillment(order_id=order.id, status=CONFIRMED)
    )
    attempt = PaymentAttempt(
        order_id=order.id,
        provider="paymob",
        payment_method="credit_card",
        status="succeeded",
        amount_minor=701100,
        currency="EGP",
        idempotency_key=f"stage6-cancel-{order.id}",
        provider_transaction_id="txn-stage6-cancel",
    )
    db_session.add(attempt)
    await db_session.flush()

    service = OrderCancellationService(db_session)
    result = await service.cancel(order.id, reason="customer_request")
    duplicate = await service.cancel(order.id, reason="customer_request")

    await db_session.refresh(product)
    await db_session.refresh(order)
    assert result["cancelled"] is True
    assert duplicate["cancelled"] is False
    assert product.stock_qty == 5
    assert order.state == "cancel"
    assert order.payment_status == "refund_requested"
    reservation = await db_session.scalar(
        select(InventoryReservation).where(InventoryReservation.order_id == order.id)
    )
    assert reservation is not None and reservation.status == RELEASED
    refund_count = await db_session.scalar(
        select(func.count(PaymentRefund.id)).where(PaymentRefund.order_id == order.id)
    )
    assert refund_count == 1


@pytest.mark.asyncio
async def test_late_verified_success_rereserves_only_payment_failure_cancellation(
    db_session: AsyncSession,
) -> None:
    partner = await _partner(db_session, "late-success")
    product = await _product(db_session, "late-success", stock_qty=5)
    order = await _order(
        db_session,
        partner,
        "late-success",
        state="cancel",
        payment_status="failed",
    )
    order.stock_reservation_released = True
    await _line(db_session, order, product, 2)
    db_session.add_all(
        [
            InventorySourceBalance(
                product_id=product.id,
                source_on_hand_qty=5,
                source="test_baseline",
            ),
            InventoryReservation(
                order_id=order.id,
                product_id=product.id,
                quantity=2,
                status=RELEASED,
            ),
            OrderFulfillment(
                order_id=order.id,
                status="cancelled",
                cancellation_reason="payment_failed",
            ),
        ]
    )
    attempt = PaymentAttempt(
        order_id=order.id,
        provider="paymob",
        payment_method="credit_card",
        status="failed",
        amount_minor=701100,
        currency="EGP",
        idempotency_key=f"stage6-late-{order.id}",
    )
    db_session.add(attempt)
    await db_session.flush()

    transition = await mark_payment_succeeded(
        db=db_session,
        order=order,
        attempt=attempt,
        provider_transaction_id="txn-stage6-late",
    )

    await db_session.refresh(product)
    assert transition == "processed"
    assert product.stock_qty == 3
    assert order.state == "sale"
    assert order.payment_status == "paid"
    assert order.stock_reservation_released is False
    lifecycle = await FulfillmentLifecycleService(db_session).get(order.id)
    assert lifecycle.status == CONFIRMED


@pytest.mark.asyncio
async def test_dispatch_and_delivery_are_separate_and_do_not_double_decrement_stock(
    db_session: AsyncSession,
) -> None:
    partner = await _partner(db_session, "shipment")
    product = await _product(db_session, "shipment", stock_qty=3)
    order = await _order(db_session, partner, "shipment")
    await _line(db_session, order, product, 2)
    db_session.add_all(
        [
            InventorySourceBalance(
                product_id=product.id,
                source_on_hand_qty=5,
                source="test_baseline",
            ),
            InventoryReservation(
                order_id=order.id,
                product_id=product.id,
                quantity=2,
                status=RESERVED,
            ),
            OrderFulfillment(order_id=order.id, status=CONFIRMED),
        ]
    )
    await db_session.flush()

    shipping = ShippingService(db_session)
    dispatched = await shipping.dispatch_order(
        order.id,
        DispatchOrderRequest(
            tracking_number="EG-STAGE6-001",
            carrier="Stage6 Express",
            reference="DO-STAGE6-001",
        ),
    )
    await db_session.refresh(product)
    reservation = await db_session.scalar(
        select(InventoryReservation).where(InventoryReservation.order_id == order.id)
    )
    assert dispatched.order_state == "done"  # legacy Odoo/API compatibility
    assert dispatched.fulfillment_status == "shipped"
    assert product.stock_qty == 3
    assert reservation is not None and reservation.status == CONSUMED_PENDING_SOURCE

    delivered = await shipping.mark_delivered(order.id)
    await db_session.refresh(product)
    assert delivered.fulfillment_status == "delivered"
    assert delivered.status == "delivered"
    assert product.stock_qty == 3


@pytest.mark.asyncio
async def test_dropship_retry_creates_one_po_and_receipt_does_not_add_local_stock(
    db_session: AsyncSession,
) -> None:
    partner = await _partner(db_session, "dropship")
    product = await _product(db_session, "dropship", stock_qty=0, dropship=True)
    supplier = Supplier(
        name="Stage 6 Supplier",
        email="stage6-supplier@elitedom.store",
        lead_time_days=3,
        is_active=True,
        is_verified=True,
    )
    db_session.add(supplier)
    await db_session.flush()
    db_session.add(
        ProductSupplier(
            product_id=product.id,
            supplier_id=supplier.id,
            supplier_sku="SUP-ST6-001",
            unit_cost_usd=Decimal("90.00"),
            lead_time_days=2,
            is_primary=True,
            is_active=True,
        )
    )
    order = await _order(db_session, partner, "dropship", is_dropship=True)
    await _line(db_session, order, product, 1)
    await db_session.flush()

    service = DropshipFulfillmentService(db_session)
    created = await service.ensure_purchase_orders_for_paid_order(order.id)
    retried = await service.ensure_purchase_orders_for_paid_order(order.id)
    assert len(created) == 1
    assert retried == []

    purchase_order = await db_session.scalar(
        select(PurchaseOrder).where(PurchaseOrder.sale_order_id == order.id)
    )
    assert purchase_order is not None
    shipment_count = await db_session.scalar(
        select(func.count(Shipment.id)).where(Shipment.order_id == order.id)
    )
    assert shipment_count == 1

    supplier_service = SupplierService(db_session)
    await supplier_service.update_purchase_order(
        purchase_order.po_number,
        PurchaseOrderUpdateRequest(status="sent"),
    )
    await supplier_service.update_purchase_order(
        purchase_order.po_number,
        PurchaseOrderUpdateRequest(status="received"),
    )
    await db_session.refresh(product)
    assert product.stock_qty == 0

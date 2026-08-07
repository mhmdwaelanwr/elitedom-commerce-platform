"""Synchronous stock-source projection used by Celery Odoo workers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ProductTemplate
from app.modules.fulfillment.models import InventoryReservation, InventorySourceBalance
from app.modules.inventory.reservations import CONSUMED, CONSUMED_PENDING_SOURCE, RESERVED


def apply_authoritative_quantity_sync(
    db: Session,
    *,
    product: ProductTemplate,
    source_quantity: int,
    source: str,
) -> tuple[int, int]:
    """Project an absolute source quantity into available-to-sell safely."""
    if source_quantity < 0:
        raise ValueError("source_quantity must be non-negative")

    balance = db.scalar(
        select(InventorySourceBalance)
        .where(InventorySourceBalance.product_id == product.id)
        .with_for_update()
    )
    previous_available = product.stock_qty
    now = datetime.now(UTC)

    if balance is None:
        withheld = int(
            db.scalar(
                select(func.coalesce(func.sum(InventoryReservation.quantity), 0)).where(
                    InventoryReservation.product_id == product.id,
                    InventoryReservation.status.in_({RESERVED, CONSUMED_PENDING_SOURCE}),
                )
            )
            or 0
        )
        product.stock_qty = max(source_quantity - withheld, 0)
        db.add(
            InventorySourceBalance(
                product_id=product.id,
                source_on_hand_qty=source_quantity,
                source=source,
                source_updated_at=now,
            )
        )
        db.flush()
        return previous_available, product.stock_qty

    delta = source_quantity - balance.source_on_hand_qty
    if delta < 0:
        remaining_decrease = -delta
        pending = list(
            db.scalars(
                select(InventoryReservation)
                .where(
                    InventoryReservation.product_id == product.id,
                    InventoryReservation.status == CONSUMED_PENDING_SOURCE,
                )
                .order_by(InventoryReservation.consumed_at, InventoryReservation.id)
                .with_for_update()
            )
        )
        for reservation in pending:
            unreconciled = reservation.quantity - reservation.source_reconciled_quantity
            if unreconciled <= 0:
                continue
            applied = min(unreconciled, remaining_decrease)
            reservation.source_reconciled_quantity += applied
            remaining_decrease -= applied
            if reservation.source_reconciled_quantity >= reservation.quantity:
                reservation.status = CONSUMED
                reservation.source_reconciled_at = now
            if remaining_decrease == 0:
                break
        if remaining_decrease:
            product.stock_qty = max(product.stock_qty - remaining_decrease, 0)
    elif delta > 0:
        product.stock_qty += delta

    balance.source_on_hand_qty = source_quantity
    balance.source = source
    balance.source_updated_at = now
    db.flush()
    return previous_available, product.stock_qty

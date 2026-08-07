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
    """Project a current Odoo physical-stock snapshot into availability."""
    if source_quantity < 0:
        raise ValueError("source_quantity must be non-negative")

    balance = db.scalar(
        select(InventorySourceBalance)
        .where(InventorySourceBalance.product_id == product.id)
        .with_for_update()
    )
    previous_available = product.stock_qty
    snapshot_at = datetime.now(UTC)
    reserved_quantity = int(
        db.scalar(
            select(func.coalesce(func.sum(InventoryReservation.quantity), 0)).where(
                InventoryReservation.product_id == product.id,
                InventoryReservation.status == RESERVED,
            )
        )
        or 0
    )
    pending = list(
        db.scalars(
            select(InventoryReservation)
            .where(
                InventoryReservation.product_id == product.id,
                InventoryReservation.status == CONSUMED_PENDING_SOURCE,
            )
            .with_for_update()
        )
    )
    for reservation in pending:
        reservation.status = CONSUMED
        reservation.source_reconciled_quantity = reservation.quantity
        reservation.source_reconciled_at = snapshot_at

    product.stock_qty = max(source_quantity - reserved_quantity, 0)
    if balance is None:
        db.add(
            InventorySourceBalance(
                product_id=product.id,
                source_on_hand_qty=source_quantity,
                source=source,
                source_updated_at=snapshot_at,
            )
        )
    else:
        balance.source_on_hand_qty = source_quantity
        balance.source = source
        balance.source_updated_at = snapshot_at
    db.flush()
    return previous_available, product.stock_qty

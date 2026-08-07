"""Concurrency-safe local inventory reservation semantics for Stage 6."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductTemplate, SaleOrderLine
from app.modules.fulfillment.models import InventoryReservation, InventorySourceBalance
from app.shared.exceptions import ExternalServiceError, InsufficientStockError, ResourceConflictError

RESERVED = "reserved"
RELEASED = "released"
CONSUMED_PENDING_SOURCE = "consumed_pending_source"
CONSUMED = "consumed"


class InventoryReservationService:
    """Own every local reservation/release/consume mutation.

    ``ProductTemplate.stock_qty`` is available-to-sell.  Checkout subtracts it
    exactly once, release restores it exactly once, and physical shipment does
    not subtract it again because those units were already withheld.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def adopt_checkout_reservations(self, order_id: int) -> int:
        """Record reservations already atomically deducted by the legacy checkout.

        Stage 5's checkout decrement is intentionally retained.  This method is
        called in the same request transaction immediately after checkout, so
        it adds durable reservation semantics without double-mutating stock.
        """
        rows = (
            await self.db.execute(
                select(SaleOrderLine, ProductTemplate)
                .join(ProductTemplate, SaleOrderLine.product_id == ProductTemplate.id)
                .where(SaleOrderLine.order_id == order_id)
            )
        ).all()
        quantities: dict[int, int] = {}
        products: dict[int, ProductTemplate] = {}
        for line, product in rows:
            if product.is_dropship_enabled:
                continue
            quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity
            products[line.product_id] = product

        recorded = 0
        for product_id in sorted(quantities):
            quantity = quantities[product_id]
            existing = await self.db.scalar(
                select(InventoryReservation)
                .where(
                    InventoryReservation.order_id == order_id,
                    InventoryReservation.product_id == product_id,
                )
                .with_for_update()
            )
            if existing is not None:
                if existing.quantity != quantity:
                    raise ResourceConflictError(
                        "The order has an incompatible persisted inventory reservation."
                    )
                continue

            product = products[product_id]
            await self._ensure_source_balance(
                product_id=product_id,
                inferred_on_hand=product.stock_qty + quantity,
            )
            self.db.add(
                InventoryReservation(
                    order_id=order_id,
                    product_id=product_id,
                    quantity=quantity,
                    status=RESERVED,
                )
            )
            recorded += quantity
        await self.db.flush()
        return recorded

    async def reserve_checkout_stock(
        self,
        *,
        order_id: int,
        products_by_id: dict[int, ProductTemplate],
        requested_quantities: dict[int, int],
    ) -> None:
        """Atomically reserve all non-dropship quantities for direct service callers."""
        for product_id in sorted(requested_quantities):
            quantity = requested_quantities[product_id]
            product = products_by_id[product_id]
            if product.is_dropship_enabled:
                continue

            existing = await self.db.scalar(
                select(InventoryReservation)
                .where(
                    InventoryReservation.order_id == order_id,
                    InventoryReservation.product_id == product_id,
                )
                .with_for_update()
            )
            if existing is not None:
                if existing.status == RESERVED and existing.quantity == quantity:
                    continue
                raise ResourceConflictError(
                    "The order already has an incompatible inventory reservation."
                )

            reservation = await self.db.execute(
                update(ProductTemplate)
                .where(
                    ProductTemplate.id == product_id,
                    ProductTemplate.is_active.is_(True),
                    ProductTemplate.is_dropship_enabled.is_(False),
                    ProductTemplate.stock_qty >= quantity,
                )
                .values(stock_qty=ProductTemplate.stock_qty - quantity)
            )
            if reservation.rowcount != 1:
                available = await self.db.scalar(
                    select(ProductTemplate.stock_qty).where(ProductTemplate.id == product_id)
                )
                raise InsufficientStockError(product.sku, quantity, int(available or 0))

            available_after = await self.db.scalar(
                select(ProductTemplate.stock_qty).where(ProductTemplate.id == product_id)
            )
            await self._ensure_source_balance(
                product_id=product_id,
                inferred_on_hand=int(available_after or 0) + quantity,
            )
            self.db.add(
                InventoryReservation(
                    order_id=order_id,
                    product_id=product_id,
                    quantity=quantity,
                    status=RESERVED,
                )
            )
        await self.db.flush()

    async def release_order(self, order_id: int) -> int:
        """Release currently reserved units once and return the released count."""
        reservations = (
            (
                await self.db.execute(
                    select(InventoryReservation)
                    .where(
                        InventoryReservation.order_id == order_id,
                        InventoryReservation.status == RESERVED,
                    )
                    .order_by(InventoryReservation.product_id)
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        released = 0
        now = datetime.now(UTC)
        for reservation in reservations:
            restored = await self.db.execute(
                update(ProductTemplate)
                .where(ProductTemplate.id == reservation.product_id)
                .values(stock_qty=ProductTemplate.stock_qty + reservation.quantity)
            )
            if restored.rowcount != 1:
                raise ExternalServiceError(
                    "Inventory", "Unable to restore stock for a released reservation."
                )
            reservation.status = RELEASED
            reservation.released_at = now
            released += reservation.quantity
        await self.db.flush()
        return released

    async def rereserve_order(self, order_id: int) -> int:
        """Safely recover released units for a verified late payment success."""
        reservations = (
            (
                await self.db.execute(
                    select(InventoryReservation)
                    .where(
                        InventoryReservation.order_id == order_id,
                        InventoryReservation.status == RELEASED,
                    )
                    .order_by(InventoryReservation.product_id)
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        reserved = 0
        for reservation in reservations:
            product = await self.db.scalar(
                select(ProductTemplate).where(ProductTemplate.id == reservation.product_id)
            )
            if product is None:
                raise ExternalServiceError("Inventory", "A reserved product no longer exists.")
            result = await self.db.execute(
                update(ProductTemplate)
                .where(
                    ProductTemplate.id == reservation.product_id,
                    ProductTemplate.stock_qty >= reservation.quantity,
                )
                .values(stock_qty=ProductTemplate.stock_qty - reservation.quantity)
            )
            if result.rowcount != 1:
                available = await self.db.scalar(
                    select(ProductTemplate.stock_qty).where(
                        ProductTemplate.id == reservation.product_id
                    )
                )
                raise InsufficientStockError(
                    product.sku,
                    reservation.quantity,
                    int(available or 0),
                )
            reservation.status = RESERVED
            reservation.released_at = None
            reserved += reservation.quantity
        await self.db.flush()
        return reserved

    async def mark_order_consumed(self, order_id: int) -> int:
        """Mark shipped reservations without subtracting available stock twice."""
        reservations = (
            (
                await self.db.execute(
                    select(InventoryReservation)
                    .where(
                        InventoryReservation.order_id == order_id,
                        InventoryReservation.status == RESERVED,
                    )
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        now = datetime.now(UTC)
        consumed = 0
        for reservation in reservations:
            reservation.status = CONSUMED_PENDING_SOURCE
            reservation.consumed_at = now
            consumed += reservation.quantity
        await self.db.flush()
        return consumed

    async def apply_authoritative_quantity(
        self,
        *,
        product: ProductTemplate,
        source_quantity: int,
        source: str,
        occurred_at: datetime | None = None,
    ) -> tuple[int, int]:
        """Apply an absolute physical-stock snapshot without losing reservations.

        Returns ``(previous_available, new_available)``.  A source-side stock
        decrease first reconciles units already shipped from a local
        reservation; only the remaining decrease changes available-to-sell.
        """
        if source_quantity < 0:
            raise ValueError("source_quantity must be non-negative")

        balance = await self.db.scalar(
            select(InventorySourceBalance)
            .where(InventorySourceBalance.product_id == product.id)
            .with_for_update()
        )
        previous_available = product.stock_qty
        now = occurred_at or datetime.now(UTC)

        if balance is None:
            withheld = int(
                (
                    await self.db.scalar(
                        select(func.coalesce(func.sum(InventoryReservation.quantity), 0)).where(
                            InventoryReservation.product_id == product.id,
                            InventoryReservation.status.in_(
                                {RESERVED, CONSUMED_PENDING_SOURCE}
                            ),
                        )
                    )
                )
                or 0
            )
            product.stock_qty = max(source_quantity - withheld, 0)
            self.db.add(
                InventorySourceBalance(
                    product_id=product.id,
                    source_on_hand_qty=source_quantity,
                    source=source,
                    source_updated_at=now,
                )
            )
            await self.db.flush()
            return previous_available, product.stock_qty

        delta = source_quantity - balance.source_on_hand_qty
        if delta < 0:
            remaining_decrease = -delta
            pending = (
                (
                    await self.db.execute(
                        select(InventoryReservation)
                        .where(
                            InventoryReservation.product_id == product.id,
                            InventoryReservation.status == CONSUMED_PENDING_SOURCE,
                        )
                        .order_by(InventoryReservation.consumed_at, InventoryReservation.id)
                        .with_for_update()
                    )
                )
                .scalars()
                .all()
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
        await self.db.flush()
        return previous_available, product.stock_qty

    async def _ensure_source_balance(self, *, product_id: int, inferred_on_hand: int) -> None:
        balance = await self.db.scalar(
            select(InventorySourceBalance)
            .where(InventorySourceBalance.product_id == product_id)
            .with_for_update()
        )
        if balance is None:
            self.db.add(
                InventorySourceBalance(
                    product_id=product_id,
                    source_on_hand_qty=inferred_on_hand,
                    source="local_baseline",
                )
            )
            await self.db.flush()

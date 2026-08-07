"""Explicit, compatibility-safe order fulfilment lifecycle for Stage 6."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SaleOrder
from app.modules.fulfillment.models import OrderFulfillment
from app.shared.exceptions import InvalidOrderStateTransition, ResourceNotFoundError

PAYMENT_PENDING = "payment_pending"
CONFIRMED = "confirmed"
PROCESSING = "processing"
READY_TO_SHIP = "ready_to_ship"
SHIPPED = "shipped"
DELIVERED = "delivered"
CANCELLED = "cancelled"
RETURN_REQUESTED = "return_requested"
RETURNED = "returned"

FULFILLMENT_TRANSITIONS: dict[str, set[str]] = {
    PAYMENT_PENDING: {CONFIRMED, CANCELLED},
    CONFIRMED: {PROCESSING, READY_TO_SHIP, SHIPPED, CANCELLED},
    PROCESSING: {READY_TO_SHIP, SHIPPED, CANCELLED},
    READY_TO_SHIP: {SHIPPED, CANCELLED},
    SHIPPED: {DELIVERED, RETURN_REQUESTED},
    DELIVERED: {RETURN_REQUESTED},
    CANCELLED: set(),
    RETURN_REQUESTED: {RETURNED},
    RETURNED: set(),
}


class FulfillmentLifecycleService:
    """Maintain the customer-facing lifecycle without replacing Odoo states."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, order_id: int, *, lock: bool = False) -> OrderFulfillment:
        query = select(OrderFulfillment).where(OrderFulfillment.order_id == order_id)
        if lock:
            query = query.with_for_update()
        record = await self.db.scalar(query)
        if record is not None:
            return record

        order_query = select(SaleOrder).where(SaleOrder.id == order_id)
        if lock:
            order_query = order_query.with_for_update()
        order = await self.db.scalar(order_query)
        if order is None:
            raise ResourceNotFoundError("SaleOrder", order_id)

        record = OrderFulfillment(order_id=order.id, status=self._legacy_status(order))
        now = datetime.now(UTC)
        if record.status == CONFIRMED:
            record.confirmed_at = order.updated_at or order.created_at or now
        elif record.status == SHIPPED:
            record.confirmed_at = order.created_at or now
            record.shipped_at = order.updated_at or order.created_at or now
        elif record.status == CANCELLED:
            record.cancelled_at = order.updated_at or order.created_at or now
        self.db.add(record)
        await self.db.flush()
        return record

    async def transition(
        self,
        order_id: int,
        target_status: str,
        *,
        occurred_at: datetime | None = None,
        allow_same: bool = True,
    ) -> OrderFulfillment:
        record = await self.get(order_id, lock=True)
        if target_status == record.status and allow_same:
            return record
        valid_targets = FULFILLMENT_TRANSITIONS.get(record.status, set())
        if target_status not in valid_targets:
            raise InvalidOrderStateTransition(record.status, target_status)

        now = occurred_at or datetime.now(UTC)
        record.status = target_status
        self._stamp(record, target_status, now)
        await self.db.flush()
        return record

    async def force_forward_from_integration(
        self,
        order_id: int,
        target_status: str,
        *,
        occurred_at: datetime | None = None,
    ) -> tuple[OrderFulfillment, bool]:
        """Apply a trusted integration update only when it moves forward."""
        record = await self.get(order_id, lock=True)
        if record.status in {CANCELLED, RETURNED}:
            return record, False
        if target_status == record.status:
            return record, False

        current_rank = self._forward_rank(record.status)
        target_rank = self._forward_rank(target_status)
        if target_rank is None or current_rank is None or target_rank <= current_rank:
            return record, False

        now = occurred_at or datetime.now(UTC)
        record.status = target_status
        self._stamp(record, target_status, now)
        await self.db.flush()
        return record, True

    @staticmethod
    def _legacy_status(order: SaleOrder) -> str:
        if order.state == "cancel":
            return CANCELLED
        # Historical ``done`` is ambiguous because local dispatch used it
        # before delivery confirmation.  Backfill conservatively as shipped.
        if order.state == "done":
            return SHIPPED
        if order.state in {"sale", "sent"}:
            return CONFIRMED
        return PAYMENT_PENDING

    @staticmethod
    def _forward_rank(status: str) -> int | None:
        return {
            PAYMENT_PENDING: 0,
            CONFIRMED: 1,
            PROCESSING: 2,
            READY_TO_SHIP: 3,
            SHIPPED: 4,
            DELIVERED: 5,
            RETURN_REQUESTED: 6,
            RETURNED: 7,
        }.get(status)

    @staticmethod
    def _stamp(record: OrderFulfillment, status: str, timestamp: datetime) -> None:
        if status == CONFIRMED:
            record.confirmed_at = record.confirmed_at or timestamp
        elif status == PROCESSING:
            record.processing_at = record.processing_at or timestamp
        elif status == READY_TO_SHIP:
            record.ready_to_ship_at = record.ready_to_ship_at or timestamp
        elif status == SHIPPED:
            record.shipped_at = record.shipped_at or timestamp
        elif status == DELIVERED:
            record.delivered_at = record.delivered_at or timestamp
        elif status == CANCELLED:
            record.cancelled_at = record.cancelled_at or timestamp
        elif status == RETURN_REQUESTED:
            record.return_requested_at = record.return_requested_at or timestamp
        elif status == RETURNED:
            record.returned_at = record.returned_at or timestamp

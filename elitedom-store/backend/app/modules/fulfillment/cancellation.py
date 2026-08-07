"""Pre-shipment order cancellation orchestration for Stage 6."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PurchaseOrder, SaleOrder
from app.modules.fulfillment.models import Shipment
from app.modules.fulfillment.service import CANCELLED, FulfillmentLifecycleService
from app.modules.inventory.reservations import InventoryReservationService
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.refunds import ensure_full_refund_request
from app.shared.events import OrderCancelled
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event
from app.shared.schemas import PaymentMethod, PaymentStatus


class OrderCancellationService:
    """Cancel an unshipped order once, release stock, and request refunds safely."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def cancel(self, order_id: int, *, reason: str) -> dict[str, object | None]:
        order = await self.db.scalar(
            select(SaleOrder).where(SaleOrder.id == order_id).with_for_update()
        )
        if order is None:
            raise ResourceNotFoundError("SaleOrder", order_id)

        lifecycle_service = FulfillmentLifecycleService(self.db)
        lifecycle = await lifecycle_service.get(order.id, lock=True)
        if lifecycle.status == CANCELLED:
            refund = await self._latest_refund(order.id)
            return {
                "order_id": order.id,
                "order_number": order.name,
                "order_state": order.state,
                "fulfillment_status": lifecycle.status,
                "payment_status": order.payment_status,
                "refund_id": refund.id if refund else None,
                "released_quantity": 0,
                "cancelled": False,
            }

        purchase_orders = (
            (
                await self.db.execute(
                    select(PurchaseOrder)
                    .where(PurchaseOrder.sale_order_id == order.id)
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        advanced_pos = [
            po.po_number
            for po in purchase_orders
            if po.status in {"sent", "partial", "received"}
        ]
        if advanced_pos:
            raise ResourceConflictError(
                "Cancellation requires operations review because supplier purchase order(s) "
                f"already advanced: {', '.join(sorted(advanced_pos))}."
            )

        _, changed = await lifecycle_service.cancel(order.id, reason=reason)
        for purchase_order in purchase_orders:
            if purchase_order.status == "draft":
                purchase_order.status = "cancelled"
                shipment = await self.db.scalar(
                    select(Shipment).where(Shipment.supplier_po_id == purchase_order.id)
                )
                if shipment is not None and shipment.status not in {"shipped", "delivered"}:
                    shipment.status = "cancelled"

        released = await InventoryReservationService(self.db).release_order(order.id)
        if released or not order.stock_reservation_released:
            order.stock_reservation_released = True
        order.state = "cancel"

        refund_id: str | None = None
        if order.payment_status == PaymentStatus.PAID.value:
            attempt = await self._latest_attempt(order.id)
            if attempt is not None or order.stripe_payment_intent_id:
                refund, _ = await ensure_full_refund_request(
                    db=self.db,
                    order=order,
                    attempt=attempt,
                    reason=reason,
                    source_context="order_cancellation",
                )
                refund_id = refund.id
            elif order.payment_method != PaymentMethod.COD.value:
                raise ResourceConflictError(
                    "The paid order has no verified provider transaction to refund."
                )
        await self.db.flush()

        if changed:
            await publish_domain_event(
                self.db,
                OrderCancelled(
                    payload={
                        "order_id": order.id,
                        "order_number": order.name,
                        "reason": reason,
                        "released_quantity": released,
                        "refund_id": refund_id,
                    }
                ),
            )

        return {
            "order_id": order.id,
            "order_number": order.name,
            "order_state": order.state,
            "fulfillment_status": lifecycle.status,
            "payment_status": order.payment_status,
            "refund_id": refund_id,
            "released_quantity": released,
            "cancelled": changed,
        }

    async def _latest_attempt(self, order_id: int) -> PaymentAttempt | None:
        return await self.db.scalar(
            select(PaymentAttempt)
            .where(PaymentAttempt.order_id == order_id)
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )

    async def _latest_refund(self, order_id: int) -> PaymentRefund | None:
        return await self.db.scalar(
            select(PaymentRefund)
            .where(PaymentRefund.order_id == order_id)
            .order_by(PaymentRefund.created_at.desc())
            .limit(1)
        )

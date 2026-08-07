"""Provider-neutral, idempotent payment state transitions."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SaleOrder
from app.modules.fulfillment.service import CANCELLED, FulfillmentLifecycleService
from app.modules.inventory.reservations import InventoryReservationService
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.refunds import ensure_full_refund_request
from app.modules.suppliers.dropship import DropshipFulfillmentService
from app.shared.events import PaymentFailed, PaymentRefunded, PaymentSucceeded
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, PaymentStatus


async def mark_payment_succeeded(
    *,
    db: AsyncSession,
    order: SaleOrder,
    attempt: PaymentAttempt,
    provider_transaction_id: str,
) -> str:
    """Confirm a verified payment once and safely recover late successes."""
    attempt.provider_transaction_id = provider_transaction_id
    if order.payment_status == PaymentStatus.REFUNDED.value:
        return "ignored"
    if order.payment_status == PaymentStatus.PAID.value:
        attempt.status = "succeeded"
        attempt.completed_at = attempt.completed_at or datetime.now(UTC)
        return "already_processed"

    lifecycle_service = FulfillmentLifecycleService(db)
    lifecycle = await lifecycle_service.get(order.id, lock=True)

    # A late success after a customer/operations cancellation must never reopen
    # fulfillment.  Record the captured payment and request a refund instead.
    if lifecycle.status == CANCELLED and lifecycle.cancellation_reason != "payment_failed":
        order.payment_status = PaymentStatus.PAID.value
        attempt.status = "succeeded"
        attempt.failure_code = None
        attempt.completed_at = datetime.now(UTC)
        await db.flush()
        await ensure_full_refund_request(
            db=db,
            order=order,
            attempt=attempt,
            reason="payment_captured_after_cancellation",
            source_context=f"{attempt.provider}_webhook",
        )
        return "refund_requested"

    if order.stock_reservation_released:
        await InventoryReservationService(db).rereserve_order(order.id)
        order.stock_reservation_released = False

    order.payment_status = PaymentStatus.PAID.value
    if order.state in {
        OrderState.DRAFT.value,
        OrderState.SENT.value,
        OrderState.CANCEL.value,
    }:
        order.state = OrderState.SALE.value
    attempt.status = "succeeded"
    attempt.failure_code = None
    attempt.completed_at = datetime.now(UTC)
    await lifecycle_service.confirm_after_verified_payment(order.id)
    await db.flush()

    await DropshipFulfillmentService(db).ensure_purchase_orders_for_paid_order(order.id)
    await publish_domain_event(
        db,
        PaymentSucceeded(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "provider": attempt.provider,
                "payment_attempt_id": attempt.id,
                "provider_transaction_id": provider_transaction_id,
            }
        ),
        source_context=f"{attempt.provider}_webhook",
    )
    return "processed"


async def mark_payment_failed(
    *,
    db: AsyncSession,
    order: SaleOrder,
    attempt: PaymentAttempt,
    provider_transaction_id: str,
    failure_code: str | None = None,
) -> str:
    """Cancel one unpaid order and release only locally reserved inventory."""
    attempt.provider_transaction_id = provider_transaction_id
    if order.payment_status in {PaymentStatus.PAID.value, PaymentStatus.REFUNDED.value}:
        return "ignored"
    if order.payment_status == PaymentStatus.FAILED.value or order.stock_reservation_released:
        attempt.status = "failed"
        attempt.failure_code = failure_code
        attempt.completed_at = attempt.completed_at or datetime.now(UTC)
        return "already_processed"

    order.payment_status = PaymentStatus.FAILED.value
    order.state = OrderState.CANCEL.value
    order.stock_reservation_released = True
    attempt.status = "failed"
    attempt.failure_code = failure_code
    attempt.completed_at = datetime.now(UTC)
    await InventoryReservationService(db).release_order(order.id)
    await FulfillmentLifecycleService(db).cancel(order.id, reason="payment_failed")
    await db.flush()

    await publish_domain_event(
        db,
        PaymentFailed(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "provider": attempt.provider,
                "payment_attempt_id": attempt.id,
                "provider_transaction_id": provider_transaction_id,
                "failure_code": failure_code,
            }
        ),
        source_context=f"{attempt.provider}_webhook",
    )
    return "processed"


async def mark_payment_refunded(
    *,
    db: AsyncSession,
    order: SaleOrder,
    attempt: PaymentAttempt,
    provider_transaction_id: str,
    provider_refund_id: str | None = None,
) -> str:
    """Record a verified provider refund without changing fulfillment stock."""
    attempt.provider_transaction_id = provider_transaction_id
    if order.payment_status == PaymentStatus.REFUNDED.value:
        attempt.status = "refunded"
        return "already_processed"
    if order.payment_status not in {
        PaymentStatus.PAID.value,
        PaymentStatus.REFUND_REQUESTED.value,
    }:
        return "ignored"

    order.payment_status = PaymentStatus.REFUNDED.value
    attempt.status = "refunded"
    attempt.completed_at = datetime.now(UTC)

    refund = await db.scalar(
        select(PaymentRefund)
        .where(PaymentRefund.order_id == order.id)
        .order_by(PaymentRefund.created_at.desc())
        .limit(1)
    )
    if refund is not None:
        refund.status = "succeeded"
        refund.provider_refund_id = provider_refund_id
        refund.completed_at = datetime.now(UTC)
        refund.failure_code = None
    await db.flush()

    await publish_domain_event(
        db,
        PaymentRefunded(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "provider": attempt.provider,
                "payment_attempt_id": attempt.id,
                "provider_transaction_id": provider_transaction_id,
                "provider_refund_id": provider_refund_id,
            }
        ),
        source_context=f"{attempt.provider}_webhook",
    )
    return "processed"

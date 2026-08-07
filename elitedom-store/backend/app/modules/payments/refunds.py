"""Shared, auditable full-refund request creation.

This module never calls an undocumented provider refund endpoint.  It records
one idempotent request and leaves provider completion to a verified callback.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SaleOrder
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.shared.events import PaymentRefundRequested
from app.shared.exceptions import ResourceConflictError
from app.shared.outbox import publish_domain_event
from app.shared.schemas import PaymentStatus


def _minor_units(amount: Decimal) -> int:
    minor = Decimal(amount) * Decimal("100")
    if amount < 0 or minor != minor.to_integral_value():
        raise ResourceConflictError("Order amount cannot be represented in payment minor units.")
    return int(minor)


async def ensure_full_refund_request(
    *,
    db: AsyncSession,
    order: SaleOrder,
    attempt: PaymentAttempt | None,
    reason: str,
    source_context: str = "application",
) -> tuple[PaymentRefund, bool]:
    """Return one durable full-refund request and whether it was newly created."""
    provider = attempt.provider if attempt else ("stripe" if order.stripe_payment_intent_id else None)
    if provider is None:
        raise ResourceConflictError("This order has no verified provider payment to refund.")

    idempotency_key = f"refund:{provider}:{order.id}:full"
    existing = await db.scalar(
        select(PaymentRefund).where(PaymentRefund.idempotency_key == idempotency_key)
    )
    if existing is not None:
        if order.payment_status != PaymentStatus.REFUNDED.value:
            order.payment_status = PaymentStatus.REFUND_REQUESTED.value
        return existing, False

    refund = PaymentRefund(
        order_id=order.id,
        attempt_id=attempt.id if attempt else None,
        provider=provider,
        amount_minor=(attempt.amount_minor if attempt else _minor_units(order.amount_total)),
        currency=(attempt.currency if attempt else order.currency),
        status="requested",
        reason=reason,
        idempotency_key=idempotency_key,
    )
    db.add(refund)
    order.payment_status = PaymentStatus.REFUND_REQUESTED.value
    await db.flush()

    await publish_domain_event(
        db,
        PaymentRefundRequested(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "provider": provider,
                "payment_attempt_id": attempt.id if attempt else None,
                "provider_transaction_id": (
                    attempt.provider_transaction_id
                    if attempt
                    else order.stripe_payment_intent_id
                ),
                "refund_id": refund.id,
                "amount_minor": refund.amount_minor,
                "currency": refund.currency,
                "reason": reason,
            }
        ),
        source_context=source_context,
    )
    return refund, True

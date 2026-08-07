"""Elitedom Store — provider-neutral payment operations."""

from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SaleOrder
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.shared.events import PaymentRefundRequested
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event
from app.shared.schemas import PaymentStatus, UserRole
from app.shared.security import get_current_user

router = APIRouter()


def _is_adminish(role: str) -> bool:
    return role in {UserRole.SYSTEM_ADMIN.value, UserRole.FINANCE_OFFICER.value}


async def _load_order(order_id: int, db: AsyncSession, *, lock: bool = False) -> SaleOrder:
    query = select(SaleOrder).where(SaleOrder.id == order_id)
    if lock:
        query = query.with_for_update()
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise ResourceNotFoundError("SaleOrder", order_id)
    return order


async def _latest_attempt(order_id: int, db: AsyncSession) -> PaymentAttempt | None:
    return await db.scalar(
        select(PaymentAttempt)
        .where(PaymentAttempt.order_id == order_id)
        .order_by(PaymentAttempt.created_at.desc())
        .limit(1)
    )


async def _latest_refund(order_id: int, db: AsyncSession) -> PaymentRefund | None:
    return await db.scalar(
        select(PaymentRefund)
        .where(PaymentRefund.order_id == order_id)
        .order_by(PaymentRefund.created_at.desc())
        .limit(1)
    )


def _minor_units(amount: Decimal) -> int:
    minor = Decimal(amount) * Decimal("100")
    if amount < 0 or minor != minor.to_integral_value():
        raise ResourceConflictError("Order amount cannot be represented in payment minor units.")
    return int(minor)


@router.get("/public/{attempt_id}")
async def get_public_payment_status(
    attempt_id: str,
    order_number: str = Query(..., min_length=8, max_length=64),
    db: AsyncSession = Depends(get_db),
):
    """Expose a non-PII status using two independently returned checkout references."""
    attempt = await db.scalar(
        select(PaymentAttempt).where(
            PaymentAttempt.id == attempt_id,
            PaymentAttempt.provider_reference == order_number,
        )
    )
    if attempt is None:
        raise ResourceNotFoundError("PaymentAttempt", attempt_id)

    order = await db.get(SaleOrder, attempt.order_id)
    if order is None or order.name != order_number:
        raise ResourceNotFoundError("PaymentAttempt", attempt_id)

    return {
        "order_number": order.name,
        "payment_status": order.payment_status,
        "provider": attempt.provider,
        "provider_attempt_status": attempt.status,
        "amount_minor": attempt.amount_minor,
        "currency": attempt.currency,
    }


@router.get("/{order_id}")
async def get_payment_status(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the local order state and latest provider attempt/refund trail."""
    order = await _load_order(order_id, db)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise ResourceNotFoundError("SaleOrder", order_id)

    attempt = await _latest_attempt(order.id, db)
    refund = await _latest_refund(order.id, db)
    return {
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "amount_total": order.amount_total,
        "currency": order.currency,
        "provider": attempt.provider if attempt else ("stripe" if order.stripe_session_id else None),
        "payment_attempt_id": attempt.id if attempt else None,
        "provider_intention_id": attempt.provider_intention_id if attempt else None,
        "provider_transaction_id": attempt.provider_transaction_id if attempt else None,
        "provider_attempt_status": attempt.status if attempt else None,
        "refund_id": refund.id if refund else None,
        "refund_status": refund.status if refund else None,
        "refund_amount_minor": refund.amount_minor if refund else None,
        # Historical Stripe identifiers remain visible for orders placed before
        # the Paymob migration, but new checkout no longer creates them.
        "stripe_session_id": order.stripe_session_id,
        "stripe_payment_intent_id": order.stripe_payment_intent_id,
    }


@router.post("/{order_id}/refund")
async def request_refund(
    order_id: int,
    reason: str = Query(default="customer_request", min_length=3, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create one full refund request without claiming provider completion."""
    order = await _load_order(order_id, db, lock=True)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise ResourceNotFoundError("SaleOrder", order_id)

    if order.payment_status != PaymentStatus.PAID.value:
        raise ResourceConflictError(
            f"Refunds can only be created for paid orders. Current status: {order.payment_status}."
        )

    attempt = await _latest_attempt(order.id, db)
    if attempt is not None and attempt.status != "succeeded":
        raise ResourceConflictError(
            f"The latest provider payment attempt is not refundable: {attempt.status}."
        )

    provider = attempt.provider if attempt else ("stripe" if order.stripe_payment_intent_id else None)
    if provider is None:
        raise ResourceConflictError("This order has no verified provider payment to refund.")

    refund = PaymentRefund(
        order_id=order.id,
        attempt_id=attempt.id if attempt else None,
        provider=provider,
        amount_minor=(attempt.amount_minor if attempt else _minor_units(order.amount_total)),
        currency=(attempt.currency if attempt else order.currency),
        status="requested",
        reason=reason,
        idempotency_key=f"refund:{provider}:{order.id}:full",
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
    )

    return {
        "status": "refund_requested",
        "refund_status": refund.status,
        "refund_id": refund.id,
        "provider": provider,
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "amount_minor": refund.amount_minor,
        "currency": refund.currency,
        "reason": reason,
    }

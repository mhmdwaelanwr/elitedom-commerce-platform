"""Elitedom Store — Payments Module Router"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SaleOrder
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


@router.get("/{order_id}")
async def get_payment_status(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get payment status for an order."""
    order = await _load_order(order_id, db)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise ResourceNotFoundError("SaleOrder", order_id)

    return {
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "stripe_session_id": order.stripe_session_id,
        "stripe_payment_intent_id": order.stripe_payment_intent_id,
        "amount_total": order.amount_total,
        "currency": order.currency,
    }


@router.post("/{order_id}/refund")
async def request_refund(
    order_id: int,
    reason: str = Query(default="customer_request", max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record a refund request; Stripe confirmation is a separate workflow."""
    # Serializing this transition prevents duplicate requests if two browser
    # tabs submit simultaneously.  It deliberately does not call Stripe or
    # claim that a provider-side refund has completed.
    order = await _load_order(order_id, db, lock=True)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise ResourceNotFoundError("SaleOrder", order_id)

    if order.payment_status != PaymentStatus.PAID.value:
        raise ResourceConflictError(
            f"Refunds can only be created for paid orders. Current status: {order.payment_status}."
        )

    order.payment_status = PaymentStatus.REFUND_REQUESTED.value
    await db.flush()

    await publish_domain_event(
        db,
        PaymentRefundRequested(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "reason": reason,
            }
        ),
    )

    return {
        "status": "refund_requested",
        "refund_status": "pending_review",
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "reason": reason,
    }

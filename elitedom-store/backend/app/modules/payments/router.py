"""Elitedom Store — provider-neutral payment operations."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SaleOrder
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.refunds import ensure_full_refund_request
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.schemas import PaymentStatus
from app.shared.security import get_current_user, require_staff_access

router = APIRouter()


async def _load_order(order_id: int, db: AsyncSession, *, lock: bool = False) -> SaleOrder:
    query = select(SaleOrder).where(SaleOrder.id == order_id)
    if lock:
        query = query.with_for_update()
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise ResourceNotFoundError("SaleOrder", order_id)
    return order


async def _authorize_cross_owner_staff(
    *,
    order_id: int,
    db: AsyncSession,
    current_user: dict,
    permission: AdminPermission,
) -> tuple[str, frozenset[str]]:
    """Authorize staff without revealing another customer's order to non-staff callers."""
    access = AdminAccessService(db)
    role, _ = await access.resolve_permissions(current_user["user_id"])
    if role is None:
        # Preserve the customer-facing anti-enumeration contract: another
        # customer's order is indistinguishable from a missing order.
        raise ResourceNotFoundError("SaleOrder", order_id)
    return await require_staff_access(
        db=db,
        current_user=current_user,
        permissions=(permission.value,),
    )


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


@router.get("/public/order/{order_number}")
async def get_public_payment_status(
    order_number: str,
    db: AsyncSession = Depends(get_db),
):
    """Expose payment state only; never return customer or order-line data."""
    order = await db.scalar(select(SaleOrder).where(SaleOrder.name == order_number))
    if order is None:
        raise ResourceNotFoundError("SaleOrder", order_number)

    attempt = await _latest_attempt(order.id, db)
    if attempt is None:
        raise ResourceNotFoundError("PaymentAttempt", order_number)

    return {
        "order_number": order.name,
        "payment_status": order.payment_status,
        "provider": attempt.provider,
        "provider_attempt_status": attempt.status,
    }


@router.get("/{order_id}")
async def get_payment_status(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the local order state and latest provider attempt/refund trail."""
    order = await _load_order(order_id, db)
    if order.partner_id != current_user["user_id"]:
        await _authorize_cross_owner_staff(
            order_id=order_id,
            db=db,
            current_user=current_user,
            permission=AdminPermission.PAYMENTS_VIEW,
        )

    attempt = await _latest_attempt(order.id, db)
    refund = await _latest_refund(order.id, db)
    return {
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "amount_total": order.amount_total,
        "currency": order.currency,
        "provider": attempt.provider
        if attempt
        else ("stripe" if order.stripe_session_id else None),
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
    request: Request,
    reason: str = Query(default="customer_request", min_length=3, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create/reuse one full refund request without claiming provider completion."""
    order = await _load_order(order_id, db, lock=True)
    privileged = order.partner_id != current_user["user_id"]
    if privileged:
        role, permissions = await _authorize_cross_owner_staff(
            order_id=order_id,
            db=db,
            current_user=current_user,
            permission=AdminPermission.PAYMENTS_REFUND,
        )
        current_user = {**current_user, "role": role, "permissions": sorted(permissions)}

    if order.payment_status not in {
        PaymentStatus.PAID.value,
        PaymentStatus.REFUND_REQUESTED.value,
    }:
        raise ResourceConflictError(
            "Refunds can only be requested for paid orders. "
            f"Current status: {order.payment_status}."
        )

    attempt = await _latest_attempt(order.id, db)
    if attempt is not None and attempt.status != "succeeded":
        raise ResourceConflictError(
            f"The latest provider payment attempt is not refundable: {attempt.status}."
        )

    before = {
        "payment_status": order.payment_status,
        "latest_attempt_id": attempt.id if attempt else None,
        "latest_attempt_status": attempt.status if attempt else None,
    }
    refund, created = await ensure_full_refund_request(
        db=db,
        order=order,
        attempt=attempt,
        reason=reason,
        source_context="payments_api",
    )

    if privileged:
        await AdminAccessService(db).record_audit(
            actor=current_user,
            action="payment.refund.request",
            entity_type="refund",
            entity_id=refund.id,
            before=before,
            after={
                "order_id": order.id,
                "payment_status": order.payment_status,
                "refund_status": refund.status,
                "amount_minor": refund.amount_minor,
                "currency": refund.currency,
                "provider": refund.provider,
                "reason": refund.reason,
                "created": created,
            },
            request=request,
        )

    return {
        "status": "refund_requested",
        "refund_status": refund.status,
        "refund_id": refund.id,
        "provider": refund.provider,
        "order_id": order.id,
        "order_number": order.name,
        "payment_status": order.payment_status,
        "amount_minor": refund.amount_minor,
        "currency": refund.currency,
        "reason": refund.reason,
        "created": created,
    }

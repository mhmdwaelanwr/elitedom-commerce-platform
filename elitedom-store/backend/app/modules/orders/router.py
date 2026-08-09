"""
Elitedom Store — Orders Module Router
Shopping cart, checkout, cancellation, and legacy order-state management.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Cart, SaleOrder
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.fulfillment.cancellation import OrderCancellationService
from app.modules.fulfillment.service import CONFIRMED, FulfillmentLifecycleService
from app.modules.inventory.reservations import InventoryReservationService
from app.modules.orders.schemas import (
    AddToCartRequest,
    CheckoutRequest,
    SaleOrderResponse,
    UpdateCartItemRequest,
)
from app.modules.orders.service import OrderService
from app.shared.exceptions import (
    InsufficientPermissionsError,
    ResourceNotFoundError,
)
from app.shared.schemas import OrderState, PaymentMethod
from app.shared.security import (
    get_current_user,
    require_permission,
    require_staff_access,
    security_scheme,
    validate_access_token,
)

router = APIRouter()


async def _has_order_permission(
    db: AsyncSession,
    current_user: dict,
    permission: AdminPermission,
) -> bool:
    try:
        await require_staff_access(
            db=db,
            current_user=current_user,
            permissions=(permission.value,),
        )
    except InsufficientPermissionsError:
        return False
    return True


async def _get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[dict]:
    """Return a session-aware authenticated subject when supplied, otherwise guest mode."""
    if credentials is None:
        return None
    return await validate_access_token(credentials.credentials, db)


def _guest_session_id(session_id: Optional[str]) -> str:
    normalized_session_id = (session_id or "").strip()
    if not normalized_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty session_id is required for anonymous cart access.",
        )
    return normalized_session_id


def _cart_owner(
    current_user: Optional[dict], session_id: Optional[str]
) -> tuple[Optional[int], Optional[str]]:
    if current_user is not None:
        return current_user["user_id"], None
    return None, _guest_session_id(session_id)


@router.post("/cart/sync")
async def sync_cart(
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Sync an explicitly identified guest cart into the authenticated cart."""
    partner_id = current_user["user_id"]
    session_id = (session_id or "").strip()
    if not session_id:
        return await OrderService(db).get_cart(partner_id=partner_id)

    guest_query = (
        select(Cart)
        .options(selectinload(Cart.items))
        .where(
            Cart.is_active.is_(True),
            Cart.partner_id.is_(None),
            Cart.session_id == session_id,
        )
    )
    guest_cart = (await db.execute(guest_query)).scalar_one_or_none()
    service = OrderService(db)
    user_cart = await service.get_cart(partner_id=partner_id)
    if not guest_cart or user_cart.id == guest_cart.id:
        return user_cart

    user_cart_row = (
        await db.execute(
            select(Cart).options(selectinload(Cart.items)).where(Cart.id == user_cart.id)
        )
    ).scalar_one()
    user_items_by_product = {item.product_id: item for item in user_cart_row.items}
    for guest_item in list(guest_cart.items):
        existing = user_items_by_product.get(guest_item.product_id)
        if existing:
            existing.quantity += guest_item.quantity
            await db.delete(guest_item)
        else:
            guest_item.cart = user_cart_row
            user_items_by_product[guest_item.product_id] = guest_item

    guest_cart.is_active = False
    await db.flush()
    return await service.get_cart(partner_id=partner_id)


@router.get("/cart")
async def get_cart(
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    return await OrderService(db).get_cart(partner_id=partner_id, session_id=guest_session_id)


@router.post("/cart/items")
async def add_to_cart(
    request: AddToCartRequest,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    return await OrderService(db).add_to_cart(
        request,
        partner_id=partner_id,
        session_id=guest_session_id,
    )


@router.put("/cart/items/{item_id}")
async def update_cart_item(
    item_id: int,
    request: UpdateCartItemRequest,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    return await OrderService(db).update_cart_item(
        item_id,
        request,
        partner_id=partner_id,
        session_id=guest_session_id,
    )


@router.delete("/cart/items/{item_id}")
async def remove_from_cart(
    item_id: int,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    return await OrderService(db).remove_from_cart(
        item_id,
        partner_id=partner_id,
        session_id=guest_session_id,
    )


@router.post("/checkout", status_code=201)
async def checkout(
    request: CheckoutRequest,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    """Submit checkout and durably snapshot the local stock reservation."""
    requested_session_id = session_id if session_id is not None else request.session_id
    partner_id, guest_session_id = _cart_owner(current_user, requested_session_id)
    response = await OrderService(db).checkout(
        request,
        partner_id=partner_id,
        session_id=guest_session_id,
    )
    await InventoryReservationService(db).adopt_checkout_reservations(response.order.id)
    lifecycle_service = FulfillmentLifecycleService(db)
    await lifecycle_service.get(response.order.id)
    if request.payment_method == PaymentMethod.COD:
        await lifecycle_service.transition(response.order.id, CONFIRMED)
    return response


@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    may_view_all = await _has_order_permission(db, current_user, AdminPermission.ORDERS_VIEW)
    query = (
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .order_by(SaleOrder.created_at.desc())
    )
    if not may_view_all:
        query = query.where(SaleOrder.partner_id == current_user["user_id"])
    if status:
        query = query.where(SaleOrder.state == status)

    count_query = select(SaleOrder.id)
    if not may_view_all:
        count_query = count_query.where(SaleOrder.partner_id == current_user["user_id"])
    if status:
        count_query = count_query.where(SaleOrder.state == status)
    total_count = len((await db.execute(count_query)).scalars().all())
    query = query.offset((page - 1) * limit).limit(limit)
    orders = (await db.execute(query)).scalars().all()
    return {
        "orders": [SaleOrderResponse.model_validate(order) for order in orders],
        "total_count": total_count,
        "page": page,
        "limit": limit,
    }


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    order = (
        await db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id)
        )
    ).scalar_one_or_none()
    if not order:
        raise ResourceNotFoundError("SaleOrder", order_id)
    may_view_all = await _has_order_permission(db, current_user, AdminPermission.ORDERS_VIEW)
    if not may_view_all and order.partner_id != current_user["user_id"]:
        raise InsufficientPermissionsError()
    return SaleOrderResponse.model_validate(order)


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    request: Request,
    target_state: OrderState = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(AdminPermission.ORDERS_MANAGE.value)),
):
    """Update the legacy Odoo-compatible state for controlled operations work."""
    order = await db.scalar(select(SaleOrder).where(SaleOrder.id == order_id))
    if order is None:
        raise ResourceNotFoundError("SaleOrder", order_id)
    before = {"state": order.state, "payment_status": order.payment_status}
    result = await OrderService(db).update_order_state(order_id, target_state)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="order.state.update",
        entity_type="order",
        entity_id=order_id,
        before=before,
        after={"state": target_state.value},
        request=request,
    )
    return result


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    request: Request,
    reason: str = Query(default="customer_request", min_length=3, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cancel only before shipment, releasing inventory and requesting refunds once."""
    order = await db.scalar(select(SaleOrder).where(SaleOrder.id == order_id))
    if order is None:
        raise ResourceNotFoundError("SaleOrder", order_id)
    before = {"state": order.state, "payment_status": order.payment_status}
    privileged = order.partner_id != current_user["user_id"]
    if privileged:
        role, permissions = await require_staff_access(
            db=db,
            current_user=current_user,
            permissions=(AdminPermission.ORDERS_MANAGE.value,),
        )
        current_user = {**current_user, "role": role, "permissions": sorted(permissions)}
    result = await OrderCancellationService(db).cancel(order_id, reason=reason)
    if privileged:
        await AdminAccessService(db).record_audit(
            actor=current_user,
            action="order.cancel",
            entity_type="order",
            entity_id=order_id,
            before=before,
            after={"reason": reason, "result": result},
            request=request,
        )
    return result

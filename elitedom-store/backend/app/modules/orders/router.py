"""
Elitedom Store — Orders Module Router
Shopping cart, checkout, and order lifecycle management.
Per FR-CART-001 to FR-ORD-004 and API_SPECIFICATION.md Section 4.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Cart, SaleOrder
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
    InvalidCredentialsError,
    ResourceNotFoundError,
)
from app.shared.schemas import OrderState, PaymentMethod, UserRole
from app.shared.security import (
    decode_token,
    get_current_user,
    require_role,
    security_scheme,
)

router = APIRouter()


def _is_adminish(role: str) -> bool:
    return role in {
        UserRole.SYSTEM_ADMIN.value,
        UserRole.WAREHOUSE_OPERATOR.value,
        UserRole.FINANCE_OFFICER.value,
    }


async def _get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Optional[dict]:
    """Return a verified access-token subject when supplied, otherwise guest mode.

    Cart and checkout endpoints are intentionally accessible to guests.  An
    absent bearer token is therefore valid, while an invalid or refresh token
    remains an authentication error rather than silently becoming a guest.
    """
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise InvalidCredentialsError()

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as error:
        raise InvalidCredentialsError() from error

    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role"),
    }


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
    """Use JWT ownership for accounts and an explicit opaque id for guests."""
    if current_user is not None:
        # Do not let an arbitrary session id switch an authenticated request
        # into somebody else's guest cart.  Guest-cart adoption is /cart/sync.
        return current_user["user_id"], None
    return None, _guest_session_id(session_id)


# ── Cart Endpoints ───────────────────────────────────────────────────────────


@router.post("/cart/sync")
async def sync_cart(
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Sync guest cart with authenticated user's persistent cart.
    FR-CART-001: Persistent shopping cart for guests and registered users.
    """
    partner_id = current_user["user_id"]

    session_id = (session_id or "").strip()
    if not session_id:
        service = OrderService(db)
        return await service.get_cart(partner_id=partner_id)

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

    if not guest_cart:
        return user_cart

    if user_cart.id == guest_cart.id:
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
    """Get a JWT-owned cart or the cart belonging to an explicit guest session."""
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    service = OrderService(db)
    return await service.get_cart(partner_id=partner_id, session_id=guest_session_id)


@router.post("/cart/items")
async def add_to_cart(
    request: AddToCartRequest,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    """Add a product to the caller's JWT-owned or guest-session cart."""
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    service = OrderService(db)
    return await service.add_to_cart(
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
    """Update an item quantity while enforcing user/session cart ownership."""
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    service = OrderService(db)
    return await service.update_cart_item(
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
    """Remove an item while enforcing user/session cart ownership."""
    partner_id, guest_session_id = _cart_owner(current_user, session_id)
    service = OrderService(db)
    return await service.remove_from_cart(
        item_id,
        partner_id=partner_id,
        session_id=guest_session_id,
    )


# ── Checkout Endpoints ───────────────────────────────────────────────────────


@router.post("/checkout", status_code=201)
async def checkout(
    request: CheckoutRequest,
    session_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(_get_optional_current_user),
):
    """Submit checkout with Stage 6 durable reservation tracking."""
    requested_session_id = session_id if session_id is not None else request.session_id
    partner_id, guest_session_id = _cart_owner(current_user, requested_session_id)
    response = await OrderService(db).checkout(
        request,
        partner_id=partner_id,
        session_id=guest_session_id,
    )

    # Stage 5 already performs the conditional SQL decrement.  Capture the
    # reservation in the same transaction rather than subtracting stock twice.
    await InventoryReservationService(db).adopt_checkout_reservations(response.order.id)
    lifecycle_service = FulfillmentLifecycleService(db)
    await lifecycle_service.get(response.order.id)
    if request.payment_method == PaymentMethod.COD:
        await lifecycle_service.transition(response.order.id, CONFIRMED)
    return response


# ── Order Management Endpoints ───────────────────────────────────────────────


@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List orders for the current user (or all orders for admin)."""
    query = (
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .order_by(SaleOrder.created_at.desc())
    )

    if not _is_adminish(current_user["role"]):
        query = query.where(SaleOrder.partner_id == current_user["user_id"])

    if status:
        query = query.where(SaleOrder.state == status)

    count_query = select(SaleOrder.id)
    if not _is_adminish(current_user["role"]):
        count_query = count_query.where(SaleOrder.partner_id == current_user["user_id"])
    if status:
        count_query = count_query.where(SaleOrder.state == status)

    total_count = len((await db.execute(count_query)).scalars().all())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    orders = result.scalars().all()

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
    """Get order details including line items."""
    query = (
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .where(SaleOrder.id == order_id)
    )
    order = (await db.execute(query)).scalar_one_or_none()
    if not order:
        raise ResourceNotFoundError("SaleOrder", order_id)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise InsufficientPermissionsError()

    return SaleOrderResponse.model_validate(order)


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    target_state: OrderState = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.WAREHOUSE_OPERATOR, UserRole.SYSTEM_ADMIN)),
):
    """Update the legacy Odoo-compatible order state for warehouse/admin callers."""
    service = OrderService(db)
    return await service.update_order_state(order_id, target_state)


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legacy cancellation route; Stage 6 cancellation orchestration wraps this next."""
    query = select(SaleOrder).where(SaleOrder.id == order_id)
    order = (await db.execute(query)).scalar_one_or_none()
    if not order:
        raise ResourceNotFoundError("SaleOrder", order_id)

    if not _is_adminish(current_user["role"]) and order.partner_id != current_user["user_id"]:
        raise InsufficientPermissionsError()

    service = OrderService(db)
    return await service.update_order_state(order_id, OrderState.CANCEL)

"""Customer tracking and controlled local/dropship shipment endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.shipping.service import (
    DispatchOrderRequest,
    DispatchOrderResponse,
    ShippingService,
    ShippingTrackingResponse,
    SupplierShipmentRequest,
)
from app.shared.schemas import UserRole
from app.shared.security import get_current_user, require_role

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]
WarehouseUser = Annotated[
    dict, Depends(require_role(UserRole.WAREHOUSE_OPERATOR, UserRole.SYSTEM_ADMIN))
]
SupplierOperationsUser = Annotated[
    dict, Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN))
]


def _may_view_all_tracking(role: str | None) -> bool:
    """Only a system administrator can inspect another customer's shipment."""
    return role == UserRole.SYSTEM_ADMIN.value


@router.get("/rates")
async def calculate_shipping_rate(
    governorate: str = Query(default="Cairo", min_length=2, max_length=64),
    weight_kg: float = Query(default=1.0, gt=0, le=1000),
):
    """Return the configured local base rate; no carrier quote is fabricated."""
    rates = {
        "Cairo": 150,
        "Giza": 50,
        "Alexandria": 75,
        "Qalyubia": 60,
        "Dakahlia": 80,
        "Sharqia": 80,
    }
    base_rate = rates.get(governorate, 100)
    return {
        "governorate": governorate,
        "weight_kg": weight_kg,
        "shipping_fee": base_rate,
        "currency": "EGP",
    }


@router.get("/{order_id}/tracking", response_model=ShippingTrackingResponse)
async def get_tracking(
    order_id: int,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ShippingTrackingResponse:
    """Get tracking for the calling customer's order, or any order for an admin."""
    return await ShippingService(db).get_tracking(
        order_id,
        current_user["user_id"],
        include_all=_may_view_all_tracking(current_user.get("role")),
    )


@router.post("/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    request: DispatchOrderRequest,
    db: DatabaseSession,
    current_user: WarehouseUser,
) -> DispatchOrderResponse:
    """Record a warehouse dispatch while keeping delivery as a separate state."""
    return await ShippingService(db).dispatch_order(order_id, request)


@router.post("/{order_id}/deliver", response_model=ShippingTrackingResponse)
async def mark_order_delivered(
    order_id: int,
    db: DatabaseSession,
    current_user: WarehouseUser,
) -> ShippingTrackingResponse:
    """Confirm delivery only after a shipment has already been dispatched."""
    return await ShippingService(db).mark_delivered(order_id)


@router.post("/{order_id}/dropship", response_model=ShippingTrackingResponse)
async def update_dropship_shipment(
    order_id: int,
    request: SupplierShipmentRequest,
    db: DatabaseSession,
    current_user: SupplierOperationsUser,
) -> ShippingTrackingResponse:
    """Record supplier-provided tracking/status for a vetted dropship PO."""
    return await ShippingService(db).update_supplier_shipment(order_id, request)

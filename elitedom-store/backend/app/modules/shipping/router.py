"""Customer tracking and permission-controlled local/dropship shipment endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.shipping.service import (
    DispatchOrderRequest,
    DispatchOrderResponse,
    ShippingService,
    ShippingTrackingResponse,
    SupplierShipmentRequest,
)
from app.shared.security import get_current_user, require_permission

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]
WarehouseUser = Annotated[
    dict, Depends(require_permission(AdminPermission.SHIPMENTS_DISPATCH.value))
]
SupplierOperationsUser = Annotated[
    dict, Depends(require_permission(AdminPermission.SUPPLIERS_MANAGE.value))
]


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
    """Get customer-owned tracking or all tracking for authorised operations staff."""
    _, permissions = await AdminAccessService(db).resolve_permissions(current_user["user_id"])
    return await ShippingService(db).get_tracking(
        order_id,
        current_user["user_id"],
        include_all=AdminPermission.SHIPMENTS_VIEW.value in permissions,
    )


@router.post("/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    payload: DispatchOrderRequest,
    request: Request,
    db: DatabaseSession,
    current_user: WarehouseUser,
) -> DispatchOrderResponse:
    """Record a warehouse dispatch while keeping delivery as a separate state."""
    result = await ShippingService(db).dispatch_order(order_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="shipment.dispatch",
        entity_type="order",
        entity_id=order_id,
        after=result,
        request=request,
    )
    return result


@router.post("/{order_id}/deliver", response_model=ShippingTrackingResponse)
async def mark_order_delivered(
    order_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: WarehouseUser,
) -> ShippingTrackingResponse:
    """Confirm delivery only after a shipment has already been dispatched."""
    result = await ShippingService(db).mark_delivered(order_id)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="shipment.deliver",
        entity_type="order",
        entity_id=order_id,
        after=result,
        request=request,
    )
    return result


@router.post("/{order_id}/dropship", response_model=ShippingTrackingResponse)
async def update_dropship_shipment(
    order_id: int,
    payload: SupplierShipmentRequest,
    request: Request,
    db: DatabaseSession,
    current_user: SupplierOperationsUser,
) -> ShippingTrackingResponse:
    """Record supplier-provided tracking/status for a vetted dropship PO."""
    result = await ShippingService(db).update_supplier_shipment(order_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="shipment.dropship.update",
        entity_type="order",
        entity_id=order_id,
        after=result,
        request=request,
    )
    return result

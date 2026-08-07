"""Stock, serial tracking, and controlled warehouse inventory endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.inventory.service import (
    BarcodeScanResponse,
    InventoryService,
    SerialNumberResponse,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
    StockLevelResponse,
)
from app.shared.security import require_permission

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
InventoryAdjuster = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_ADJUST.value))
]
InventoryViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_VIEW.value))
]


@router.post("/adjust", response_model=StockAdjustmentResponse)
async def adjust_stock(
    payload: StockAdjustmentRequest,
    request: Request,
    db: DatabaseSession,
    current_user: InventoryAdjuster,
) -> StockAdjustmentResponse:
    """Apply a validated manual stock delta with a durable audit record."""
    result = await InventoryService(db).adjust_stock(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="inventory.stock.adjust",
        entity_type="product",
        entity_id=payload.sku,
        before={"stock_qty": result.previous_stock_qty},
        after={
            "stock_qty": result.stock_qty,
            "quantity_delta": result.quantity_delta,
            "reason": payload.reason,
        },
        request=request,
    )
    return result


@router.get("/serial/{serial_number}", response_model=SerialNumberResponse)
async def lookup_serial(
    serial_number: str,
    db: DatabaseSession,
    current_user: InventoryViewer,
) -> SerialNumberResponse:
    """Look up a warehouse serial number for authorised fulfilment and warranty work."""
    return await InventoryService(db).lookup_serial(serial_number)


@router.get("/scan", response_model=BarcodeScanResponse)
async def barcode_scan(
    db: DatabaseSession,
    current_user: InventoryViewer,
    barcode: str = Query(..., min_length=1, max_length=128),
) -> BarcodeScanResponse:
    """Resolve a scanned SKU/barcode from the local product catalogue."""
    return await InventoryService(db).scan_barcode(barcode)


@router.get("/{sku}", response_model=StockLevelResponse)
async def get_stock_level(
    sku: str,
    db: DatabaseSession,
) -> StockLevelResponse:
    """Get the persisted real-time stock level for a product SKU."""
    return await InventoryService(db).get_stock_level(sku)

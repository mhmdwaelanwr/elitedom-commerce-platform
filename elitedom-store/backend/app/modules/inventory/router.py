"""Stock, serial tracking, and controlled warehouse inventory endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.inventory.service import (
    BarcodeScanResponse,
    InventoryService,
    SerialNumberResponse,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
    StockLevelResponse,
)
from app.shared.schemas import UserRole
from app.shared.security import require_role

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
InventoryManagerUser = Annotated[
    dict, Depends(require_role(UserRole.INVENTORY_MANAGER, UserRole.SYSTEM_ADMIN))
]
WarehouseUser = Annotated[
    dict, Depends(require_role(UserRole.WAREHOUSE_OPERATOR, UserRole.SYSTEM_ADMIN))
]


@router.post("/adjust", response_model=StockAdjustmentResponse)
async def adjust_stock(
    request: StockAdjustmentRequest,
    db: DatabaseSession,
    current_user: InventoryManagerUser,
) -> StockAdjustmentResponse:
    """Apply a validated manual stock delta (inventory manager/admin only)."""
    return await InventoryService(db).adjust_stock(request)


@router.get("/serial/{serial_number}", response_model=SerialNumberResponse)
async def lookup_serial(
    serial_number: str,
    db: DatabaseSession,
    current_user: WarehouseUser,
) -> SerialNumberResponse:
    """Look up a warehouse serial number for fulfilment and warranty work."""
    return await InventoryService(db).lookup_serial(serial_number)


@router.get("/scan", response_model=BarcodeScanResponse)
async def barcode_scan(
    db: DatabaseSession,
    current_user: WarehouseUser,
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

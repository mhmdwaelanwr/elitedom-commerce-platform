"""Inventory queries and controlled local stock adjustments.

The service intentionally works only with the local persistence model.  Odoo
stock synchronisation is handled by the integration boundary; these endpoints
never manufacture warehouse or supplier data when it has not been recorded.
"""

from datetime import date

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductTemplate, StockLot
from app.shared.events import InventoryUpdated
from app.shared.exceptions import InsufficientStockError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event


class StockLevelResponse(BaseModel):
    sku: str
    stock_qty: int
    tracking: str
    is_available: bool
    is_dropship: bool


class StockAdjustmentRequest(BaseModel):
    """An explicit, signed-in inventory correction expressed as a delta."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    sku: str = Field(..., min_length=2, max_length=64)
    quantity_delta: int = Field(
        ...,
        validation_alias=AliasChoices("quantity_delta", "adjustment", "delta"),
        description="Positive to receive stock; negative to remove stock.",
    )
    reason: str = Field(..., min_length=3, max_length=500)

    @field_validator("sku", "reason")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value must not be blank.")
        return value.strip()

    @model_validator(mode="after")
    def require_non_zero_delta(self) -> "StockAdjustmentRequest":
        if self.quantity_delta == 0:
            raise ValueError("quantity_delta must not be zero.")
        return self


class StockAdjustmentResponse(BaseModel):
    sku: str
    previous_stock_qty: int
    quantity_delta: int
    stock_qty: int


class SerialNumberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    serial_number: str
    product_name: str
    sku: str
    warranty_expiration_date: date | None = None
    is_warranty_active: bool


class BarcodeScanResponse(BaseModel):
    barcode: str
    sku: str
    name: str
    stock_qty: int
    list_price: float
    # Warehouse/bin locations are not represented by the local schema yet.
    # Returning null avoids pretending that an inventory location is known.
    warehouse_location: str | None = None


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stock_level(self, sku: str) -> StockLevelResponse:
        """Return the persisted stock and dropship availability for one SKU."""
        product = await self._get_product_by_sku(sku)
        return StockLevelResponse(
            sku=product.sku,
            stock_qty=product.stock_qty,
            tracking=product.tracking,
            is_available=product.is_active
            and (product.stock_qty > 0 or product.is_dropship_enabled),
            is_dropship=product.is_dropship_enabled,
        )

    async def lookup_serial(self, serial_number: str) -> SerialNumberResponse:
        """Look up a recorded serial number and its current warranty window."""
        cleaned_serial = serial_number.strip()
        result = await self.db.execute(
            select(StockLot)
            .options(selectinload(StockLot.product))
            .where(StockLot.name == cleaned_serial)
        )
        lot = result.scalar_one_or_none()
        if not lot:
            raise ResourceNotFoundError("SerialNumber", cleaned_serial)

        product = lot.product
        return SerialNumberResponse(
            serial_number=lot.name,
            product_name=product.name,
            sku=product.sku,
            warranty_expiration_date=lot.warranty_expiration_date,
            is_warranty_active=(
                lot.warranty_expiration_date is not None
                and lot.warranty_expiration_date >= date.today()
            ),
        )

    async def adjust_stock(self, request: StockAdjustmentRequest) -> StockAdjustmentResponse:
        """Apply a non-negative local stock correction under a row lock."""
        product = await self._get_product_by_sku(request.sku, for_update=True)
        previous_stock_qty = product.stock_qty
        new_stock_qty = previous_stock_qty + request.quantity_delta
        if new_stock_qty < 0:
            raise InsufficientStockError(
                product.sku,
                abs(request.quantity_delta),
                previous_stock_qty,
            )

        product.stock_qty = new_stock_qty
        await self.db.flush()

        await publish_domain_event(
            self.db,
            InventoryUpdated(
                payload={
                    "product_id": product.id,
                    "sku": product.sku,
                    "previous_stock_qty": previous_stock_qty,
                    "quantity_delta": request.quantity_delta,
                    "stock_qty": new_stock_qty,
                    "reason": request.reason,
                }
            ),
        )
        return StockAdjustmentResponse(
            sku=product.sku,
            previous_stock_qty=previous_stock_qty,
            quantity_delta=request.quantity_delta,
            stock_qty=new_stock_qty,
        )

    async def scan_barcode(self, barcode: str) -> BarcodeScanResponse:
        """Resolve the locally stored barcode/SKU without inventing a bin location."""
        cleaned_barcode = barcode.strip()
        product = await self._get_product_by_sku(cleaned_barcode)
        return BarcodeScanResponse(
            barcode=cleaned_barcode,
            sku=product.sku,
            name=product.name,
            stock_qty=product.stock_qty,
            list_price=float(product.list_price),
            warehouse_location=None,
        )

    async def _get_product_by_sku(self, sku: str, *, for_update: bool = False) -> ProductTemplate:
        cleaned_sku = sku.strip()
        query = select(ProductTemplate).where(
            func.lower(ProductTemplate.sku) == cleaned_sku.lower()
        )
        if for_update:
            query = query.with_for_update()

        result = await self.db.execute(query)
        product = result.scalar_one_or_none()
        if not product:
            raise ResourceNotFoundError("Product", cleaned_sku)
        return product

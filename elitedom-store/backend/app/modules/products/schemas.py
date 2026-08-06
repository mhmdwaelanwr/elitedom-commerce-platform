"""
Elitedom Store — Products Module Schemas
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    sku: str = Field(..., min_length=2, max_length=64)
    description: Optional[str] = None
    tracking: str = Field(default="serial", pattern="^(serial|barcode)$")
    base_cost_usd: Decimal = Field(..., ge=0)
    target_margin_percent: Decimal = Field(..., ge=0, le=100)
    list_price: Decimal = Field(..., ge=0)
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_dropship_enabled: bool = False
    # New catalogue records are drafts until a verified supplier mapping is
    # configured. ProductService prevents publishing a record without one.
    is_active: bool = False
    stock_qty: int = Field(default=0, ge=0)
    weight_kg: Optional[Decimal] = None
    warranty_months: int = Field(default=12, ge=0)
    # Compatibility matrix
    socket_type: Optional[str] = None
    ram_type: Optional[str] = None
    form_factor: Optional[str] = None
    power_wattage_draw: int = Field(default=0, ge=0)
    pcie_gen: Optional[str] = None


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    base_cost_usd: Optional[Decimal] = Field(None, ge=0)
    target_margin_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    list_price: Optional[Decimal] = Field(None, ge=0)
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_dropship_enabled: Optional[bool] = None
    stock_qty: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    # Compatibility matrix
    socket_type: Optional[str] = None
    ram_type: Optional[str] = None
    form_factor: Optional[str] = None
    power_wattage_draw: Optional[int] = Field(None, ge=0)
    pcie_gen: Optional[str] = None


class ProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    alt_text: Optional[str] = None
    is_primary: bool


class ProductDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    sku: str
    description: Optional[str] = None
    tracking: str
    base_cost_usd: Decimal
    target_margin_percent: Decimal
    list_price: Decimal
    category_id: Optional[int] = None
    brand: Optional[str] = None
    is_dropship_enabled: bool
    is_active: bool
    stock_qty: int
    weight_kg: Optional[Decimal] = None
    warranty_months: int
    socket_type: Optional[str] = None
    ram_type: Optional[str] = None
    form_factor: Optional[str] = None
    power_wattage_draw: int
    pcie_gen: Optional[str] = None
    images: list[ProductImageResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProductSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    sku: str
    list_price: Decimal
    stock_qty: int
    is_dropship_enabled: bool
    brand: Optional[str] = None
    category_id: Optional[int] = None
    images: list[ProductImageResponse] = []


class ProductListResponse(BaseModel):
    total_count: int
    page: int
    limit: int
    products: list[ProductSummaryResponse]

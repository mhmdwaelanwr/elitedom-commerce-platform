"""Typed product-catalog API contracts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=2, max_length=255)
    sku: str = Field(..., min_length=2, max_length=64)
    description: str | None = None
    tracking: str = Field(default="serial", pattern="^(serial|barcode)$")
    base_cost_usd: Decimal = Field(..., ge=0)
    target_margin_percent: Decimal = Field(..., ge=0, le=100)
    list_price: Decimal = Field(..., ge=0)
    category_id: int | None = None
    brand: str | None = Field(default=None, max_length=128)
    is_dropship_enabled: bool = False
    is_active: bool = False
    stock_qty: int = Field(default=0, ge=0)
    weight_kg: Decimal | None = Field(default=None, ge=0)
    warranty_months: int = Field(default=12, ge=0, le=120)
    socket_type: str | None = Field(default=None, max_length=32)
    ram_type: str | None = Field(default=None, max_length=32)
    form_factor: str | None = Field(default=None, max_length=32)
    power_wattage_draw: int = Field(default=0, ge=0)
    pcie_gen: str | None = Field(default=None, max_length=32)

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.upper()


class ProductUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    tracking: str | None = Field(default=None, pattern="^(serial|barcode)$")
    base_cost_usd: Decimal | None = Field(default=None, ge=0)
    target_margin_percent: Decimal | None = Field(default=None, ge=0, le=100)
    list_price: Decimal | None = Field(default=None, ge=0)
    category_id: int | None = None
    brand: str | None = Field(default=None, max_length=128)
    is_dropship_enabled: bool | None = None
    stock_qty: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    weight_kg: Decimal | None = Field(default=None, ge=0)
    warranty_months: int | None = Field(default=None, ge=0, le=120)
    socket_type: str | None = Field(default=None, max_length=32)
    ram_type: str | None = Field(default=None, max_length=32)
    form_factor: str | None = Field(default=None, max_length=32)
    power_wattage_draw: int | None = Field(default=None, ge=0)
    pcie_gen: str | None = Field(default=None, max_length=32)


class ProductCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None = None


class ProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    alt_text: str | None = None
    sort_order: int
    is_primary: bool


class ProductDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    description: str | None = None
    tracking: str
    base_cost_usd: Decimal
    target_margin_percent: Decimal
    list_price: Decimal
    category_id: int | None = None
    category: ProductCategoryResponse | None = None
    brand: str | None = None
    is_dropship_enabled: bool
    is_active: bool
    stock_qty: int
    weight_kg: Decimal | None = None
    warranty_months: int
    socket_type: str | None = None
    ram_type: str | None = None
    form_factor: str | None = None
    power_wattage_draw: int
    pcie_gen: str | None = None
    images: list[ProductImageResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None


class ProductSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    description: str | None = None
    list_price: Decimal
    stock_qty: int
    is_dropship_enabled: bool
    brand: str | None = None
    category_id: int | None = None
    category: ProductCategoryResponse | None = None
    warranty_months: int
    images: list[ProductImageResponse] = Field(default_factory=list)
    socket_type: str | None = None
    ram_type: str | None = None
    form_factor: str | None = None
    power_wattage_draw: int
    pcie_gen: str | None = None


class ProductListResponse(BaseModel):
    total_count: int
    page: int
    limit: int
    products: list[ProductSummaryResponse]

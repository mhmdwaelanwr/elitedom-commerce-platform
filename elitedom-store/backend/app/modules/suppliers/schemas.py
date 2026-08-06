"""Validated API contracts for suppliers and purchase orders."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

PurchaseOrderStatus = Literal["draft", "sent", "partial", "received", "cancelled"]


class SupplierCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    contact_name: str | None = Field(default=None, max_length=128)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)
    lead_time_days: int = Field(default=7, ge=0, le=365)
    is_verified: bool = False
    performance_rating: Decimal | None = Field(default=None, ge=0, le=5, decimal_places=2)
    defect_rate_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100, decimal_places=2)

    @field_validator("name", "contact_name", "phone", "address", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    @model_validator(mode="after")
    def require_name(self) -> SupplierCreateRequest:
        if not self.name:
            raise ValueError("name must not be blank")
        return self


class SupplierUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_name: str | None = Field(default=None, max_length=128)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    is_verified: bool | None = None
    performance_rating: Decimal | None = Field(default=None, ge=0, le=5, decimal_places=2)
    defect_rate_percent: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    is_active: bool | None = None

    @field_validator("name", "contact_name", "phone", "address", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_name: str | None = None
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    lead_time_days: int
    is_active: bool
    is_verified: bool
    performance_rating: Decimal | None = None
    total_orders: int
    defect_rate_percent: Decimal
    created_at: datetime


class SupplierListResponse(BaseModel):
    suppliers: list[SupplierResponse]
    total_count: int
    page: int
    limit: int


class ProductSupplierUpsertRequest(BaseModel):
    """One supplier catalogue entry; only an explicit primary can dropship."""

    supplier_sku: str = Field(..., min_length=1, max_length=64)
    unit_cost_usd: Decimal = Field(..., ge=0, decimal_places=2)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    is_primary: bool = False
    is_active: bool = True

    @field_validator("supplier_sku")
    @classmethod
    def normalize_supplier_sku(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("supplier_sku must not be blank")
        return value

    @model_validator(mode="after")
    def primary_link_must_be_active(self) -> ProductSupplierUpsertRequest:
        if self.is_primary and not self.is_active:
            raise ValueError("A primary supplier link must be active.")
        return self


class ProductSupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    supplier_id: int
    supplier_sku: str
    unit_cost_usd: Decimal
    lead_time_days: int | None = None
    is_primary: bool
    is_active: bool
    created_at: datetime


class ProductSupplierListResponse(BaseModel):
    product_suppliers: list[ProductSupplierResponse]


class SupplierPerformanceResponse(BaseModel):
    supplier: SupplierResponse
    total_purchase_orders: int
    received_purchase_orders: int
    open_purchase_orders: int
    on_time_deliveries: int
    on_time_delivery_rate_percent: Decimal | None = None
    average_delivery_days: Decimal | None = None
    defect_rate_percent: Decimal


class PurchaseOrderItemRequest(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1, le=100_000)
    unit_cost: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class PurchaseOrderCreateRequest(BaseModel):
    supplier_id: int = Field(..., ge=1)
    items: list[PurchaseOrderItemRequest] = Field(..., min_length=1, max_length=200)
    currency: str = Field(default="USD", pattern=r"^[A-Za-z]{3}$")
    expected_delivery_date: date | None = None
    sale_order_id: int | None = Field(default=None, ge=1)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def prevent_duplicate_products(self) -> PurchaseOrderCreateRequest:
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Each product may appear only once in a purchase order.")
        return self


class PurchaseOrderUpdateRequest(BaseModel):
    status: PurchaseOrderStatus
    actual_delivery_date: date | None = None


class PurchaseOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    po_number: str
    supplier_id: int
    sale_order_id: int | None = None
    status: PurchaseOrderStatus
    items_payload: dict
    total_amount: Decimal
    currency: str
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    created_at: datetime


class PurchaseOrderListResponse(BaseModel):
    purchase_orders: list[PurchaseOrderResponse]
    total_count: int
    page: int
    limit: int

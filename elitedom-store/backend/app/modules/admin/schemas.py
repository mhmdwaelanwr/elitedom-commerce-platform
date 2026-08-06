"""Typed, least-privilege API contracts for the staff administration console."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.shared.schemas import OrderState, PaymentStatus, PickingState, RFQStatus, RMAStatus


class AdminDashboardMetrics(BaseModel):
    """Small, operationally useful KPI set; values are sourced from local records."""

    total_customers: int
    total_orders: int
    orders_today: int
    paid_revenue: Decimal
    paid_revenue_today: Decimal
    pending_orders: int
    pending_shipments: int
    low_stock_products: int
    pending_rma_claims: int
    active_rfqs: int


class AdminRevenueTrendPoint(BaseModel):
    date: date
    orders: int
    paid_revenue: Decimal


class AdminDashboardResponse(BaseModel):
    metrics: AdminDashboardMetrics
    revenue_trend: list[AdminRevenueTrendPoint]
    recent_orders: list[AdminOrderSummary]
    low_stock: list[AdminProductSummary]


class AdminOrderLine(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    quantity: int
    unit_price: Decimal
    discount_percent: Decimal
    line_total: Decimal


class AdminOrderSummary(BaseModel):
    id: int
    order_number: str
    customer_id: int
    customer_name: str
    customer_email: str
    customer_phone: str
    state: OrderState
    payment_method: str
    payment_status: PaymentStatus
    amount_total: Decimal
    shipping_governorate: str | None = None
    is_dropship: bool
    created_at: datetime


class AdminOrderDetail(AdminOrderSummary):
    amount_subtotal: Decimal
    amount_shipping: Decimal
    amount_tax: Decimal
    shipping_address: str
    notes: str | None = None
    odoo_order_id: int | None = None
    order_lines: list[AdminOrderLine]


class AdminOrderListResponse(BaseModel):
    orders: list[AdminOrderSummary]
    total_count: int
    page: int
    limit: int


class AdminOrderStateUpdateRequest(BaseModel):
    state: OrderState


class AdminProductSummary(BaseModel):
    id: int
    name: str
    sku: str
    brand: str | None = None
    category_name: str | None = None
    list_price: Decimal
    stock_qty: int
    tracking: str
    is_active: bool
    is_dropship_enabled: bool
    stock_health: str
    updated_at: datetime | None = None


class AdminProductListResponse(BaseModel):
    products: list[AdminProductSummary]
    total_count: int
    page: int
    limit: int


class AdminStockAdjustmentRequest(BaseModel):
    """A reasoned stock delta. The product is identified by the URL, not client SKU."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    quantity_delta: int = Field(..., ge=-1_000_000, le=1_000_000)
    reason: str = Field(..., min_length=3, max_length=500)

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value: str) -> str:
        if not value:
            raise ValueError("reason must not be blank.")
        return value

    @model_validator(mode="after")
    def require_non_zero_delta(self) -> AdminStockAdjustmentRequest:
        if self.quantity_delta == 0:
            raise ValueError("quantity_delta must not be zero.")
        return self


class AdminStockAdjustmentResponse(BaseModel):
    product_id: int
    sku: str
    previous_stock_qty: int
    quantity_delta: int
    stock_qty: int


class AdminCustomerSummary(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    role: str
    is_active: bool
    email_verified: bool
    governorate: str | None = None
    created_at: datetime
    order_count: int
    lifetime_value: Decimal


class AdminCustomerDetail(AdminCustomerSummary):
    street_address: str | None = None
    last_order_at: datetime | None = None


class AdminCustomerListResponse(BaseModel):
    customers: list[AdminCustomerSummary]
    total_count: int
    page: int
    limit: int


class AdminRMAItem(BaseModel):
    ticket_number: str
    status: RMAStatus
    customer_id: int
    customer_name: str
    customer_email: str
    order_id: int
    order_number: str
    product_id: int
    product_name: str
    sku: str
    serial_number: str | None = None
    reason: str
    evidence_media_url: str | None = None
    resolution_notes: str | None = None
    resolved_by: int | None = None
    created_at: datetime
    updated_at: datetime | None = None


class AdminRMAListResponse(BaseModel):
    claims: list[AdminRMAItem]
    total_count: int
    page: int
    limit: int


class AdminRFQSummary(BaseModel):
    id: int
    rfq_code: str
    status: RFQStatus
    customer_id: int
    customer_name: str
    customer_email: str
    item_count: int
    total_estimated_value: Decimal | None = None
    validity_date: date | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class AdminRFQListResponse(BaseModel):
    rfqs: list[AdminRFQSummary]
    total_count: int
    page: int
    limit: int


class AdminShipmentSummary(BaseModel):
    id: int
    picking_reference: str
    picking_type: str
    state: PickingState
    order_id: int | None = None
    order_number: str | None = None
    order_state: OrderState | None = None
    customer_name: str | None = None
    tracking_number: str | None = None
    supplier_po_ref: str | None = None
    scheduled_date: datetime | None = None
    completed_date: datetime | None = None
    created_at: datetime


class AdminShipmentListResponse(BaseModel):
    shipments: list[AdminShipmentSummary]
    total_count: int
    page: int
    limit: int

"""Read-only reporting API contracts without exposing customer PII."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class RevenueSeriesPoint(BaseModel):
    period: str
    order_count: int
    revenue: Decimal


class TopProductResponse(BaseModel):
    product_id: int
    sku: str
    name: str
    units_sold: int
    revenue: Decimal


class LowStockProductResponse(BaseModel):
    product_id: int
    sku: str
    name: str
    stock_qty: int
    is_dropship_enabled: bool


class RecentOrderResponse(BaseModel):
    order_id: int
    order_number: str
    state: str
    payment_status: str
    amount_total: Decimal
    created_at: datetime


class DashboardResponse(BaseModel):
    generated_at: datetime
    total_revenue: Decimal
    total_orders: int
    paid_orders: int
    active_customers: int
    average_order_value: Decimal
    orders_by_state: dict[str, int]
    revenue_series: list[RevenueSeriesPoint]
    best_sellers: list[TopProductResponse]
    low_stock_products: list[LowStockProductResponse]
    recent_orders: list[RecentOrderResponse]


class SalesReportResponse(BaseModel):
    period: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    total_revenue: Decimal
    total_orders: int
    series: list[RevenueSeriesPoint]


class InventoryReportResponse(BaseModel):
    total_sku_count: int
    total_units_on_hand: int
    total_cost_value_usd: Decimal
    total_retail_value_egp: Decimal
    low_stock_products: list[LowStockProductResponse]


class RmaTrendResponse(BaseModel):
    total_claims: int
    claims_by_status: dict[str, int]
    recent_claims: int


class SupplierReportItem(BaseModel):
    supplier_id: int
    name: str
    is_active: bool
    total_purchase_orders: int
    received_purchase_orders: int
    open_purchase_orders: int
    performance_rating: Decimal | None = None
    defect_rate_percent: Decimal


class SupplierReportResponse(BaseModel):
    suppliers: list[SupplierReportItem]

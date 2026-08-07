"""Contracts for finance, procurement, integration, and safe configuration control-plane views."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AdminPaymentAttemptItem(BaseModel):
    id: str
    order_id: int
    order_number: str
    customer_name: str
    customer_email: str
    provider: str
    payment_method: str
    status: str
    amount_minor: int
    currency: str
    provider_intention_id: str | None = None
    provider_transaction_id: str | None = None
    failure_code: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class AdminPaymentAttemptListResponse(BaseModel):
    payments: list[AdminPaymentAttemptItem]
    total_count: int
    page: int
    limit: int


class AdminRefundItem(BaseModel):
    id: str
    order_id: int
    order_number: str
    customer_name: str
    customer_email: str
    provider: str
    amount_minor: int
    currency: str
    status: str
    reason: str
    provider_refund_id: str | None = None
    failure_code: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class AdminRefundListResponse(BaseModel):
    refunds: list[AdminRefundItem]
    total_count: int
    page: int
    limit: int


class AdminRefundRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class AdminRefundRequestResponse(BaseModel):
    refund_id: str
    order_id: int
    order_number: str
    provider: str
    status: str
    amount_minor: int
    currency: str
    created: bool


class AdminIntegrationCheck(BaseModel):
    key: str
    label: str
    configured: bool


class AdminIntegrationStatus(BaseModel):
    key: str
    label: str
    enabled: bool
    status: Literal["ready", "disabled", "incomplete", "unsupported"]
    checks: list[AdminIntegrationCheck]


class AdminRuntimeConfiguration(BaseModel):
    environment: str
    debug: bool
    metrics_enabled: bool
    app_version: str
    allowed_host_count: int
    cors_origin_count: int
    trusted_proxy_count: int
    media_public_path: str


class AdminIntegrationStatusResponse(BaseModel):
    integrations: list[AdminIntegrationStatus]
    runtime: AdminRuntimeConfiguration


class AdminSupplierSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_name: str | None = None
    email: str
    phone: str | None = None
    lead_time_days: int
    is_active: bool
    is_verified: bool
    performance_rating: Decimal | None = None
    total_orders: int
    defect_rate_percent: Decimal
    created_at: datetime


class AdminSupplierListResponse(BaseModel):
    suppliers: list[AdminSupplierSummary]
    total_count: int
    page: int
    limit: int


class AdminPurchaseOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    po_number: str
    supplier_id: int
    sale_order_id: int | None = None
    status: str
    total_amount: Decimal
    currency: str
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    created_at: datetime


class AdminPurchaseOrderListResponse(BaseModel):
    purchase_orders: list[AdminPurchaseOrderSummary]
    total_count: int
    page: int
    limit: int

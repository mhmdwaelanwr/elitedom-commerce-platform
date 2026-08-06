"""
Elitedom Store — Shared Pydantic Schemas
Value objects shared across bounded contexts per CONTEXT_MAP.md (Section 5: Shared Kernel).
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# ── Enums ────────────────────────────────────────────────────────────────────


class CompanyType(str, Enum):
    PERSON = "person"
    COMPANY = "company"


class OrderState(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    SALE = "sale"
    DONE = "done"
    CANCEL = "cancel"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUND_REQUESTED = "refund_requested"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CREDIT_CARD = "credit_card"
    MOBILE_WALLET = "mobile_wallet"
    COD = "cod"


class TrackingMode(str, Enum):
    SERIAL = "serial"
    BARCODE = "barcode"


class PickingType(str, Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"
    INTERNAL = "internal"
    DROPSHIP = "dropship"


class PickingState(str, Enum):
    DRAFT = "draft"
    WAITING = "waiting"
    CONFIRMED = "confirmed"
    ASSIGNED = "assigned"
    DONE = "done"


class RMAStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class RFQStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    QUOTED = "quoted"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class LoyaltyTransactionType(str, Enum):
    PURCHASE_EARN = "purchase_earn"
    ORDER_REDEMPTION = "order_redemption"
    ADMIN_ADJUSTMENT = "admin_adjustment"


class UserRole(str, Enum):
    CUSTOMER = "customer"
    B2B_CLIENT = "b2b_client"
    CUSTOMER_SUPPORT = "customer_support"
    WAREHOUSE_OPERATOR = "warehouse_operator"
    INVENTORY_MANAGER = "inventory_manager"
    FINANCE_OFFICER = "finance_officer"
    SYSTEM_ADMIN = "system_admin"


# ── Shared Value Objects ─────────────────────────────────────────────────────


class Money(BaseModel):
    """Monetary value with currency per Shared Kernel."""

    amount: Decimal = Field(..., ge=0, decimal_places=2)
    currency: str = Field(default="EGP", max_length=3)


class Address(BaseModel):
    """Address value object per Shared Kernel."""

    street: str
    city: str
    governorate: str
    postal_code: Optional[str] = None
    country: str = "Egypt"


# ── Base Schemas ─────────────────────────────────────────────────────────────


class BaseSchema(BaseModel):
    """Base schema with ORM mode enabled."""

    model_config = ConfigDict(from_attributes=True)


class TimestampMixin(BaseModel):
    """Mixin for created_at / updated_at timestamps."""

    created_at: datetime
    updated_at: Optional[datetime] = None


class PaginationParams(BaseModel):
    """Standard pagination query parameters."""

    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PaginatedResponse(BaseModel):
    """Standard paginated response wrapper."""

    total_count: int
    page: int
    limit: int
    total_pages: int


class APIResponse(BaseModel):
    """Standard API response envelope."""

    status: str = "success"
    message: Optional[str] = None
    data: Optional[dict] = None

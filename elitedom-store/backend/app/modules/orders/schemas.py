"""
Elitedom Store — Orders Module Schemas
Pydantic schemas for shopping cart, checkout, and order management.
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.shared.schemas import OrderState, PaymentMethod, PaymentStatus


class CartItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int = Field(..., ge=1)
    product_name: Optional[str] = None
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    sku: Optional[str] = None


class CartSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    partner_id: Optional[int] = None
    session_id: Optional[str] = None
    items: list[CartItemSchema] = []
    subtotal: Decimal = Field(default=Decimal("0.00"))
    item_count: int = 0


class AddToCartRequest(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(default=1, ge=1, le=100)


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=100)


class CheckoutRequest(BaseModel):
    """The common checkout payload for authenticated and guest buyers.

    Guest contact fields are deliberately optional at the schema level because
    authenticated customers already have a persisted partner profile.  The
    checkout service requires all three fields whenever it is invoked without
    an authenticated ``partner_id``.
    """

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    shipping_address: str = Field(..., min_length=5, max_length=500)
    shipping_governorate: str = Field(default="Cairo", max_length=64)
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD
    use_loyalty_points: bool = False
    notes: Optional[str] = Field(default=None, max_length=2000)
    # ``guest_*`` aliases keep the public API intuitive for clients that use
    # guest-specific naming while the canonical field names remain customer_*.
    customer_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=128,
        validation_alias=AliasChoices("customer_name", "guest_name"),
    )
    customer_email: Optional[EmailStr] = Field(
        default=None,
        validation_alias=AliasChoices("customer_email", "guest_email"),
    )
    customer_mobile: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=20,
        validation_alias=AliasChoices("customer_mobile", "guest_mobile"),
    )
    # Existing cart endpoints use a query parameter.  Accepting the same value
    # in the payload makes SDK clients resilient while the route still prefers
    # an explicit query parameter when both are supplied.
    session_id: Optional[str] = Field(default=None, min_length=1, max_length=255)

    @field_validator("customer_mobile")
    @classmethod
    def validate_egyptian_mobile(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = re.sub(r"[\s\-]", "", value)
        if not re.match(r"^(\+20|0)1[0125]\d{8}$", cleaned):
            raise ValueError(
                "Invalid Egyptian mobile number. Expected format: " "+201XXXXXXXXX or 01XXXXXXXXX"
            )
        return cleaned

    @model_validator(mode="after")
    def require_complete_guest_contact_details(self) -> "CheckoutRequest":
        contact_values = (
            self.customer_name,
            self.customer_email,
            self.customer_mobile,
        )
        if any(value is not None for value in contact_values) and not all(contact_values):
            raise ValueError(
                "customer_name, customer_email, and customer_mobile must be provided together."
            )
        return self


class SaleOrderLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    discount_percent: Decimal
    line_total: Decimal


class SaleOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    partner_id: int
    state: OrderState
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    amount_subtotal: Decimal
    amount_shipping: Decimal
    amount_tax: Decimal
    amount_total: Decimal
    currency: str
    shipping_address: str
    shipping_governorate: Optional[str] = None
    odoo_order_id: Optional[int] = None
    # Legacy Stripe identifiers remain readable while existing orders age out.
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    is_dropship: bool
    notes: Optional[str] = None
    created_at: datetime
    order_lines: list[SaleOrderLineResponse] = []


class CheckoutResponse(BaseModel):
    order: SaleOrderResponse
    payment_gateway_url: Optional[str] = None
    payment_provider: Optional[str] = None
    payment_attempt_id: Optional[str] = None
    paymob_intention_id: Optional[str] = None
    # Kept for backwards-compatible clients reading historical Stripe checkouts.
    stripe_session_id: Optional[str] = None

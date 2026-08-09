"""Pydantic contracts for the B2B request-for-quote workflow."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.shared.schemas import PaymentMethod, RFQStatus


class RFQItemRequest(BaseModel):
    """A product and requested quantity in a new institutional RFQ."""

    model_config = ConfigDict(extra="forbid")

    product_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1, le=100_000)


class ProcurementDetailsRequest(BaseModel):
    """Commercial context supplied by the institutional buyer for one RFQ."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=3, max_length=180)
    needed_by: date | None = None
    delivery_location: str | None = Field(default=None, max_length=180)
    budget_target: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=14,
        decimal_places=2,
    )
    payment_terms: str | None = Field(default=None, max_length=180)

    @field_validator("delivery_location", "payment_terms")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value or None


class SubmitRFQRequest(BaseModel):
    """Payload supplied by a B2B client when requesting a quotation."""

    model_config = ConfigDict(extra="forbid")

    items: list[RFQItemRequest] = Field(..., min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=4_000)
    procurement: ProcurementDetailsRequest | None = None
    # Staff may submit on behalf of a verified institutional customer. B2B
    # clients are always constrained to their own partner record.
    partner_id: int | None = Field(default=None, ge=1)

    @field_validator("items")
    @classmethod
    def require_unique_products(cls, items: list[RFQItemRequest]) -> list[RFQItemRequest]:
        product_ids = [item.product_id for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Each product may appear only once in an RFQ.")
        return items


class QuoteItemRequest(BaseModel):
    """An optional finance override for one requested RFQ line."""

    model_config = ConfigDict(extra="forbid")

    product_id: int = Field(..., ge=1)
    # Quantities are immutable after the client submits the RFQ. Including the
    # field makes client integrations explicit while the service checks it is
    # identical to the requested quantity.
    quantity: int | None = Field(default=None, ge=1, le=100_000)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    discount_percent: Decimal | None = Field(
        default=None, ge=0, le=100, max_digits=5, decimal_places=2
    )

    @model_validator(mode="after")
    def require_one_pricing_override(self) -> QuoteItemRequest:
        if self.unit_price is not None and self.discount_percent is not None:
            raise ValueError(
                "Provide either unit_price or discount_percent for a quote line, not both."
            )
        return self


class IssueQuoteRequest(BaseModel):
    """Payload used by Finance/Admin to issue or revise a B2B quote."""

    model_config = ConfigDict(extra="forbid")

    # Omitting item overrides applies the customer's active pricelist to every
    # RFQ line. This supports quick issuance of standard corporate quotes.
    items: list[QuoteItemRequest] | None = Field(default=None, max_length=100)
    validity_date: date
    terms: str | None = Field(default=None, max_length=4_000)

    @field_validator("items")
    @classmethod
    def require_unique_quote_products(
        cls, items: list[QuoteItemRequest] | None
    ) -> list[QuoteItemRequest] | None:
        if items is None:
            return items
        product_ids = [item.product_id for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Each product may appear only once in quote overrides.")
        return items


class ConvertRFQRequest(BaseModel):
    """Delivery and payment details required to turn an accepted quote into an order."""

    model_config = ConfigDict(extra="forbid")

    shipping_address: str | None = Field(default=None, min_length=5, max_length=500)
    shipping_governorate: str | None = Field(default=None, max_length=64)
    payment_method: PaymentMethod = PaymentMethod.COD
    notes: str | None = Field(default=None, max_length=4_000)
    # The same key may be supplied in the Idempotency-Key HTTP header. The
    # service persists only a hash, never the client-supplied key itself.
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


class RFQItemResponse(BaseModel):
    """Client-safe representation of an RFQ line and its quoted price, if any."""

    product_id: int
    quantity: int
    product_name: str | None = None
    sku: str | None = None
    list_price: Decimal | None = None
    quoted_unit_price: Decimal | None = None
    discount_percent: Decimal | None = None
    line_total: Decimal | None = None
    pricing_source: str | None = None


class QuoteDetailsResponse(BaseModel):
    terms: str | None = None
    currency: str = "EGP"
    issued_at: datetime | None = None
    issued_by: int | None = None


class ProcurementDetailsResponse(BaseModel):
    """Identity-safe commercial snapshot rendered by the RFQ workspace."""

    title: str | None = None
    company_name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    needed_by: date | None = None
    delivery_location: str | None = None
    budget_target: Decimal | None = None
    payment_terms: str | None = None


class B2BRFQResponse(BaseModel):
    """Structured RFQ representation; intentionally excludes raw JSON metadata."""

    id: int
    rfq_code: str
    partner_id: int
    status: RFQStatus
    items: list[RFQItemResponse]
    procurement: ProcurementDetailsResponse | None = None
    validity_date: date | None = None
    total_estimated_value: Decimal | None = None
    notes: str | None = None
    quote: QuoteDetailsResponse | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class B2BRFQListResponse(BaseModel):
    rfqs: list[B2BRFQResponse]
    total_count: int
    page: int
    limit: int


class B2BSaleOrderLineResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    discount_percent: Decimal
    line_total: Decimal


class B2BSaleOrderResponse(BaseModel):
    id: int
    name: str
    partner_id: int
    state: str
    payment_method: str
    payment_status: str
    amount_subtotal: Decimal
    amount_shipping: Decimal
    amount_tax: Decimal
    amount_total: Decimal
    shipping_address: str
    shipping_governorate: str | None = None
    is_dropship: bool
    notes: str | None = None
    created_at: datetime | None = None
    order_lines: list[B2BSaleOrderLineResponse]


class RFQConversionResponse(BaseModel):
    rfq_code: str
    status: RFQStatus
    order_id: int
    order_number: str
    idempotent: bool = False
    order: B2BSaleOrderResponse

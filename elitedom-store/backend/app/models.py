"""
Elitedom Store — SQLAlchemy Models
Complete database schema per DATABASE_ERD.md.
All 11 entity groups mapped to SQLAlchemy ORM models.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# =============================================================================
# 3.1 — Users, Partners & App Tokens (res.partner)
# =============================================================================
class Partner(Base):
    __tablename__ = "res_partner"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    company_type: Mapped[str] = mapped_column(
        String(32), default="person", nullable=False
    )  # 'person' (B2C) | 'company' (B2B)
    email: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    pricelist_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_pricelist.id"), nullable=True
    )
    is_dropship_vendor: Mapped[bool] = mapped_column(Boolean, default=False)
    mobile_fcm_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    governorate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    street_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="customer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    orders: Mapped[list["SaleOrder"]] = relationship(back_populates="partner")
    loyalty_entries: Mapped[list["LoyaltyLedger"]] = relationship(back_populates="partner")
    rma_tickets: Mapped[list["RMATicket"]] = relationship(back_populates="partner")
    b2b_rfqs: Mapped[list["B2BRFQ"]] = relationship(back_populates="partner")
    shipping_addresses: Mapped[list["CustomerAddress"]] = relationship(
        back_populates="partner", cascade="all, delete-orphan"
    )
    wishlist_items: Mapped[list["WishlistItem"]] = relationship(
        back_populates="partner", cascade="all, delete-orphan"
    )


class CustomerAddress(Base):
    """A customer-owned shipping address used by the account dashboard."""

    __tablename__ = "elitedom_customer_address"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False, default="Home")
    recipient_name: Mapped[str] = mapped_column(String(128), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    street_address: Mapped[str] = mapped_column(Text, nullable=False)
    address_line_2: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(64), nullable=False)
    governorate: Mapped[str] = mapped_column(String(64), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    country: Mapped[str] = mapped_column(String(64), nullable=False, default="Egypt")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    partner: Mapped["Partner"] = relationship(back_populates="shipping_addresses")

    __table_args__ = (
        Index(
            "ix_elitedom_customer_address_partner_default",
            "partner_id",
            "is_default",
        ),
    )


# =============================================================================
# 3.2 — Product Category Tree
# =============================================================================
class ProductCategory(Base):
    __tablename__ = "product_public_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_public_category.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Self-referential relationship for category tree
    parent: Mapped["ProductCategory | None"] = relationship(
        "ProductCategory", remote_side=[id], backref="children"
    )
    products: Mapped[list["ProductTemplate"]] = relationship(back_populates="category")


# =============================================================================
# 3.2 — Hardware Product Catalog & Compatibility Matrix
# =============================================================================
class ProductTemplate(Base):
    """
    Product master data with hardware compatibility matrix.
    Per DATABASE_ERD.md Section 3.2.
    """

    __tablename__ = "product_template"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tracking: Mapped[str] = mapped_column(String(32), default="serial")  # 'serial' | 'barcode'
    base_cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    target_margin_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    list_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # EGP
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_public_category.id"), nullable=True
    )
    brand: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    is_dropship_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    warranty_months: Mapped[int] = mapped_column(Integer, default=12)

    # Compatibility Matrix Fields
    socket_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ram_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    form_factor: Mapped[str | None] = mapped_column(String(32), nullable=True)
    power_wattage_draw: Mapped[int] = mapped_column(Integer, default=0)
    pcie_gen: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    category: Mapped["ProductCategory | None"] = relationship(back_populates="products")
    serial_lots: Mapped[list["StockLot"]] = relationship(back_populates="product")
    images: Mapped[list["ProductImage"]] = relationship(back_populates="product")
    wishlist_items: Mapped[list["WishlistItem"]] = relationship(back_populates="product")
    supplier_links: Mapped[list["ProductSupplier"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_product_brand_category", "brand", "category_id"),)


class ProductImage(Base):
    __tablename__ = "product_image"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    product: Mapped["ProductTemplate"] = relationship(back_populates="images")


class WishlistItem(Base):
    """A durable customer-to-product wishlist entry."""

    __tablename__ = "elitedom_wishlist_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    partner: Mapped["Partner"] = relationship(back_populates="wishlist_items")
    product: Mapped["ProductTemplate"] = relationship(back_populates="wishlist_items")

    __table_args__ = (
        UniqueConstraint(
            "partner_id",
            "product_id",
            name="uq_elitedom_wishlist_item_partner_product",
        ),
        Index("ix_elitedom_wishlist_item_partner_created", "partner_id", "created_at"),
    )


# =============================================================================
# 3.3 — Unique Serial Number Tracking (stock.lot)
# =============================================================================
class StockLot(Base):
    """Per DATABASE_ERD.md Section 3.3."""

    __tablename__ = "stock_lot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=False
    )
    sale_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id"), nullable=True
    )
    warranty_expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["ProductTemplate"] = relationship(back_populates="serial_lots")
    sale_order: Mapped["SaleOrder | None"] = relationship(back_populates="serial_lots")


# =============================================================================
# 3.4 — Multi-Currency & Rate Ledger
# =============================================================================
class Currency(Base):
    __tablename__ = "res_currency"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(8), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    rates: Mapped[list["CurrencyRate"]] = relationship(back_populates="currency")


class CurrencyRate(Base):
    __tablename__ = "res_currency_rate"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    currency_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_currency.id"), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    currency: Mapped["Currency"] = relationship(back_populates="rates")


# =============================================================================
# 3.5 — B2B Tiered Pricelists
# =============================================================================
class Pricelist(Base):
    __tablename__ = "product_pricelist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    items: Mapped[list["PricelistItem"]] = relationship(back_populates="pricelist")


class PricelistItem(Base):
    __tablename__ = "product_pricelist_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pricelist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_pricelist.id"), nullable=False
    )
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=True
    )
    min_quantity: Mapped[int] = mapped_column(Integer, default=1)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    pricelist: Mapped["Pricelist"] = relationship(back_populates="items")


# =============================================================================
# 3.6 — Sales & Checkout Orders
# =============================================================================
class SaleOrder(Base):
    """Per DATABASE_ERD.md Section 3.6."""

    __tablename__ = "sale_order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    state: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    amount_subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_shipping: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    amount_tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    amount_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Persist the tender currency with the priced order.  Payment-provider
    # webhooks must validate it alongside the amount instead of relying on a
    # mutable process configuration value.
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="EGP", server_default=text("'EGP'")
    )
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
    shipping_governorate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    odoo_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    # A failed Stripe payment releases locally reserved non-dropship stock.
    # Keeping this durable flag makes release retries and duplicate webhooks
    # safe even when deliveries race or are replayed.
    stock_reservation_released: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_dropship: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="orders")
    order_lines: Mapped[list["SaleOrderLine"]] = relationship(back_populates="order")
    serial_lots: Mapped[list["StockLot"]] = relationship(back_populates="sale_order")
    pickings: Mapped[list["StockPicking"]] = relationship(back_populates="sale_order")
    hedera_audits: Mapped[list["HederaAudit"]] = relationship(back_populates="order")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="sale_order")


class StripeWebhookEvent(Base):
    """Minimal, non-sensitive audit record used to deduplicate Stripe events.

    Raw payment payloads intentionally are not stored: they can contain
    customer details and are unnecessary once the verified event id, object
    id, event type, and resulting order are retained.
    """

    __tablename__ = "elitedom_stripe_webhook_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stripe_event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    stripe_object_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id", ondelete="SET NULL"), nullable=True, index=True
    )
    processing_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="processed", server_default="processed"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SaleOrderLine(Base):
    __tablename__ = "sale_order_line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("sale_order.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["SaleOrder"] = relationship(back_populates="order_lines")


# =============================================================================
# 3.7 — Inventory & Fulfillment (stock.picking)
# =============================================================================
class StockPicking(Base):
    """Per DATABASE_ERD.md Section 3.7."""

    __tablename__ = "stock_picking"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    sale_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sale_order.id"), nullable=True)
    picking_type: Mapped[str] = mapped_column(String(32), nullable=False)
    state: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    courier_tracking_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    supplier_po_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sale_order: Mapped["SaleOrder | None"] = relationship(back_populates="pickings")


# =============================================================================
# 3.8 — Warranty & RMA Management
# =============================================================================
class RMATicket(Base):
    """Per DATABASE_ERD.md Section 3.8."""

    __tablename__ = "elitedom_rma_ticket"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("sale_order.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=False
    )
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_media_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending_review")
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    partner: Mapped["Partner"] = relationship(back_populates="rma_tickets")


# =============================================================================
# 3.9 — B2B Quotations & RFQ
# =============================================================================
class B2BRFQ(Base):
    """Per DATABASE_ERD.md Section 3.9."""

    __tablename__ = "elitedom_b2b_rfq"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rfq_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    items_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="submitted")
    validity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    partner: Mapped["Partner"] = relationship(back_populates="b2b_rfqs")


# =============================================================================
# 3.10 — Loyalty Program Ledger
# =============================================================================
class LoyaltyLedger(Base):
    """Per DATABASE_ERD.md Section 3.10."""

    __tablename__ = "elitedom_loyalty_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    points_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(32), nullable=False)
    reference_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    partner: Mapped["Partner"] = relationship(back_populates="loyalty_entries")


# =============================================================================
# 3.11 — Web3 Audit & Hedera Immutable Ledger
# =============================================================================
class HederaAudit(Base):
    """Per DATABASE_ERD.md Section 3.11."""

    __tablename__ = "elitedom_hedera_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_ref: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id"), nullable=True
    )
    payload_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    hedera_tx_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["SaleOrder | None"] = relationship(back_populates="hedera_audits")


# =============================================================================
# Inbound integration delivery receipts
# =============================================================================
class WebhookReceipt(Base):
    """Idempotency receipt for trusted inbound integration webhooks.

    Odoo can retry an already-delivered webhook when a network response is
    lost.  Keeping a compact receipt lets the API acknowledge those retries
    without applying the same stock or fulfillment mutation twice.
    """

    __tablename__ = "elitedom_webhook_receipt"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    event_key: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "source",
            "event_key",
            name="uq_elitedom_webhook_receipt_source_event",
        ),
        Index(
            "ix_elitedom_webhook_receipt_source_received",
            "source",
            "received_at",
        ),
    )


# =============================================================================
# Transactional integration outbox
# =============================================================================
class OutboxEvent(Base):
    """A durable domain event awaiting hand-off to an integration worker.

    Business transactions create these records in the same database session as
    the entity change that produced them.  ``dispatched`` means that Celery
    accepted a follow-up task; it never means that an external provider has
    completed the requested operation.
    """

    __tablename__ = "elitedom_outbox_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    source_context: Mapped[str] = mapped_column(String(64), nullable=False, default="application")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatched_task: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    __table_args__ = (
        Index(
            "ix_elitedom_outbox_event_status_available",
            "status",
            "available_at",
        ),
        Index(
            "ix_elitedom_outbox_event_source_created",
            "source_context",
            "created_at",
        ),
    )


# =============================================================================
# Supplier & Purchase Orders
# =============================================================================
class Supplier(Base):
    __tablename__ = "elitedom_supplier"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email: Mapped[str] = mapped_column(String(128), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Supplier contact details alone do not authorize dropship fulfilment.
    # An administrator must explicitly verify the supplier before it may be
    # selected as a product's primary dropship route.
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    performance_rating: Mapped[Decimal | None] = mapped_column(
        Numeric(3, 2), nullable=True
    )  # 0.00 to 5.00
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    defect_rate_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="supplier")
    product_links: Mapped[list["ProductSupplier"]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )


class ProductSupplier(Base):
    """A vetted supplier catalogue entry for one locally sold product.

    ``is_primary`` is intentionally a per-product choice rather than an
    automatic cheapest-price decision.  That keeps payment-time fulfilment
    deterministic and prevents routing a paid customer order to an unvetted
    supplier merely because a mapping happens to exist.
    """

    __tablename__ = "elitedom_product_supplier"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_template.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("elitedom_supplier.id", ondelete="RESTRICT"),
        nullable=False,
    )
    supplier_sku: Mapped[str] = mapped_column(String(64), nullable=False)
    unit_cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    product: Mapped["ProductTemplate"] = relationship(back_populates="supplier_links")
    supplier: Mapped["Supplier"] = relationship(back_populates="product_links")

    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "supplier_id",
            name="uq_elitedom_product_supplier_product_supplier",
        ),
        # This is the database guard behind the explicit primary selection in
        # the suppliers API.  PostgreSQL enforces it in production while the
        # SQLite condition keeps our integration tests representative.
        Index(
            "uq_elitedom_product_supplier_primary",
            "product_id",
            unique=True,
            postgresql_where=text("is_primary"),
            sqlite_where=text("is_primary = 1"),
        ),
        Index(
            "ix_elitedom_product_supplier_supplier_active",
            "supplier_id",
            "is_active",
        ),
    )


class PurchaseOrder(Base):
    __tablename__ = "elitedom_purchase_order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    supplier_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("elitedom_supplier.id"), nullable=False
    )
    sale_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id"), nullable=True
    )
    # Only system-generated dropship POs receive this deterministic key.  The
    # unique constraint makes confirmed-payment retries safe without blocking
    # legitimate manually-created POs for the same supplier/order.
    fulfillment_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    items_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_orders")
    sale_order: Mapped["SaleOrder | None"] = relationship(back_populates="purchase_orders")

    __table_args__ = (
        UniqueConstraint(
            "fulfillment_key",
            name="uq_elitedom_purchase_order_fulfillment_key",
        ),
    )


# =============================================================================
# Shopping Cart (for persistent guest/authenticated carts)
# =============================================================================
class Cart(Base):
    __tablename__ = "elitedom_cart"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("res_partner.id"), nullable=True
    )
    session_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )  # For guest carts
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    items: Mapped[list["CartItem"]] = relationship(back_populates="cart")


class CartItem(Base):
    __tablename__ = "elitedom_cart_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(Integer, ForeignKey("elitedom_cart.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_template.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    cart: Mapped["Cart"] = relationship(back_populates="items")


# =============================================================================
# Support Tickets
# =============================================================================
class SupportTicket(Base):
    __tablename__ = "elitedom_support_ticket"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="general")
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(32), default="open")
    assigned_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    related_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id"), nullable=True
    )
    related_rma_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("elitedom_rma_ticket.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

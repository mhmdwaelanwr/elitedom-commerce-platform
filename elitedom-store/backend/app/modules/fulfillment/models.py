"""Stage 6 persistence for inventory reservations and order fulfilment.

The legacy ``sale_order.state`` and ``stock_picking`` tables remain intact for
Odoo/API compatibility.  These models add the explicit, auditable lifecycle
needed by the storefront without overloading those legacy values.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventorySourceBalance(Base):
    """Last authoritative physical stock snapshot received for one product.

    ``ProductTemplate.stock_qty`` remains available-to-sell for backwards
    compatibility.  The source balance lets absolute Odoo snapshots be applied
    as deltas so an in-flight local reservation is never erased by a sync.
    """

    __tablename__ = "elitedom_inventory_source_balance"

    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_template.id", ondelete="CASCADE"),
        primary_key=True,
    )
    source_on_hand_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="local_baseline")
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class InventoryReservation(Base):
    """One local-stock reservation per order/product pair.

    Dropship lines never receive a reservation.  ``consumed_pending_source``
    means the warehouse shipped units that were already removed from
    available-to-sell at checkout, while the authoritative stock source has not
    yet necessarily reflected that physical movement.
    """

    __tablename__ = "elitedom_inventory_reservation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sale_order.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("product_template.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="reserved", server_default="reserved"
    )
    source_reconciled_quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_reconciled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "product_id",
            name="uq_inventory_reservation_order_product",
        ),
        Index("ix_inventory_reservation_product_status", "product_id", "status"),
        Index("ix_inventory_reservation_order_status", "order_id", "status"),
    )


class OrderFulfillment(Base):
    """Explicit customer/operations lifecycle layered over legacy Odoo states."""

    __tablename__ = "elitedom_order_fulfillment"

    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sale_order.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="payment_pending", server_default="payment_pending"
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_to_ship_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    return_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    __table_args__ = (Index("ix_order_fulfillment_status", "status"),)


class Shipment(Base):
    """Provider-neutral shipment facts for a local or dropship fulfilment leg."""

    __tablename__ = "elitedom_shipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sale_order.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_po_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("elitedom_purchase_order.id", ondelete="SET NULL"),
        nullable=True,
    )
    shipment_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    fulfillment_leg: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending", server_default="pending"
    )
    carrier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    external_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    __table_args__ = (
        Index("ix_shipment_order_status", "order_id", "status"),
        Index("ix_shipment_tracking", "tracking_number"),
    )

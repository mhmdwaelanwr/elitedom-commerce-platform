"""Provider-neutral payment persistence for checkout, callbacks, and refunds."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PaymentAttempt(Base):
    """One immutable-priced attempt to pay a local sale order."""

    __tablename__ = "elitedom_payment_attempt"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_payment_attempt_idempotency_key"),
        UniqueConstraint(
            "provider",
            "provider_intention_id",
            name="uq_payment_attempt_provider_intention",
        ),
        Index("ix_payment_attempt_order_created", "order_id", "created_at"),
        Index("ix_payment_attempt_provider_transaction", "provider", "provider_transaction_id"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sale_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="created", server_default="created"
    )
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    provider_intention_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_order_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentWebhookEvent(Base):
    """Minimal callback receipt used for replay protection and reconciliation."""

    __tablename__ = "elitedom_payment_webhook_event"
    __table_args__ = (
        UniqueConstraint("provider", "event_key", name="uq_payment_webhook_provider_event"),
        Index("ix_payment_webhook_order_created", "order_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    event_key: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    attempt_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("elitedom_payment_attempt.id", ondelete="SET NULL"), nullable=True
    )
    order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale_order.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(64), nullable=False, default="received", server_default="received"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentRefund(Base):
    """A provider refund request with a stable idempotency key."""

    __tablename__ = "elitedom_payment_refund"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_payment_refund_idempotency_key"),
        UniqueConstraint(
            "provider",
            "provider_refund_id",
            name="uq_payment_refund_provider_refund",
        ),
        Index("ix_payment_refund_order_created", "order_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sale_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempt_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("elitedom_payment_attempt.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="requested", server_default="requested"
    )
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    provider_refund_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

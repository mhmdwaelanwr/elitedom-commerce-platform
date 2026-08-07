"""Add provider-neutral payment attempts, webhook receipts, and refunds.

Revision ID: 0009_paymob_payment_records
Revises: 0008_auth_sessions_otp
Create Date: 2026-08-07 03:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_paymob_payment_records"
down_revision: str | None = "0008_auth_sessions_otp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_payment_attempt",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="created",
            nullable=False,
        ),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("provider_intention_id", sa.String(length=255), nullable=True),
        sa.Column("provider_order_id", sa.String(length=255), nullable=True),
        sa.Column("provider_transaction_id", sa.String(length=255), nullable=True),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column("failure_code", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_payment_attempt_idempotency_key",
        ),
        sa.UniqueConstraint(
            "provider",
            "provider_intention_id",
            name="uq_payment_attempt_provider_intention",
        ),
    )
    op.create_index(
        "ix_elitedom_payment_attempt_order_id",
        "elitedom_payment_attempt",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        "ix_payment_attempt_order_created",
        "elitedom_payment_attempt",
        ["order_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_payment_attempt_provider_transaction",
        "elitedom_payment_attempt",
        ["provider", "provider_transaction_id"],
        unique=False,
    )

    op.create_table(
        "elitedom_payment_webhook_event",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("provider_transaction_id", sa.String(length=255), nullable=True),
        sa.Column(
            "processing_status",
            sa.String(length=64),
            server_default="received",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["elitedom_payment_attempt.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "event_key",
            name="uq_payment_webhook_provider_event",
        ),
    )
    op.create_index(
        "ix_elitedom_payment_webhook_event_order_id",
        "elitedom_payment_webhook_event",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        "ix_payment_webhook_order_created",
        "elitedom_payment_webhook_event",
        ["order_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "elitedom_payment_refund",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="requested",
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("provider_refund_id", sa.String(length=255), nullable=True),
        sa.Column("failure_code", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["elitedom_payment_attempt.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_payment_refund_idempotency_key",
        ),
        sa.UniqueConstraint(
            "provider",
            "provider_refund_id",
            name="uq_payment_refund_provider_refund",
        ),
    )
    op.create_index(
        "ix_elitedom_payment_refund_order_id",
        "elitedom_payment_refund",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        "ix_payment_refund_order_created",
        "elitedom_payment_refund",
        ["order_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_payment_refund_order_created", table_name="elitedom_payment_refund")
    op.drop_index("ix_elitedom_payment_refund_order_id", table_name="elitedom_payment_refund")
    op.drop_table("elitedom_payment_refund")

    op.drop_index(
        "ix_payment_webhook_order_created",
        table_name="elitedom_payment_webhook_event",
    )
    op.drop_index(
        "ix_elitedom_payment_webhook_event_order_id",
        table_name="elitedom_payment_webhook_event",
    )
    op.drop_table("elitedom_payment_webhook_event")

    op.drop_index(
        "ix_payment_attempt_provider_transaction",
        table_name="elitedom_payment_attempt",
    )
    op.drop_index("ix_payment_attempt_order_created", table_name="elitedom_payment_attempt")
    op.drop_index("ix_elitedom_payment_attempt_order_id", table_name="elitedom_payment_attempt")
    op.drop_table("elitedom_payment_attempt")

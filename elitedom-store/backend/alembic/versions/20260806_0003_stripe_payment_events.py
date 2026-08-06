"""Add Stripe webhook idempotency records and stock-release state.

Revision ID: 0003_stripe_payment_events
Revises: 0002_customer_portal
Create Date: 2026-08-06 01:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_stripe_payment_events"
down_revision: str | None = "0002_customer_portal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sale_order",
        sa.Column(
            "stock_reservation_released",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_sale_order_stripe_session_id",
        "sale_order",
        ["stripe_session_id"],
        unique=False,
    )
    op.create_index(
        "ix_sale_order_stripe_payment_intent_id",
        "sale_order",
        ["stripe_payment_intent_id"],
        unique=False,
    )
    op.create_table(
        "elitedom_stripe_webhook_event",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("stripe_event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("stripe_object_id", sa.String(length=255), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column(
            "processing_status",
            sa.String(length=32),
            nullable=False,
            server_default="processed",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "processed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stripe_event_id"),
    )
    op.create_index(
        "ix_elitedom_stripe_webhook_event_order_id",
        "elitedom_stripe_webhook_event",
        ["order_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_stripe_webhook_event_order_id",
        table_name="elitedom_stripe_webhook_event",
    )
    op.drop_table("elitedom_stripe_webhook_event")
    op.drop_index("ix_sale_order_stripe_payment_intent_id", table_name="sale_order")
    op.drop_index("ix_sale_order_stripe_session_id", table_name="sale_order")
    op.drop_column("sale_order", "stock_reservation_released")

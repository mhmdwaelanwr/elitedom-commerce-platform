"""Add idempotency receipts for inbound Odoo webhooks.

Revision ID: 0004_odoo_webhook_receipts
Revises: 0003_stripe_payment_events
Create Date: 2026-08-06 01:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_odoo_webhook_receipts"
down_revision: str | None = "0003_stripe_payment_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_webhook_receipt",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("event_key", sa.String(length=128), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source",
            "event_key",
            name="uq_elitedom_webhook_receipt_source_event",
        ),
    )
    op.create_index(
        "ix_elitedom_webhook_receipt_source_received",
        "elitedom_webhook_receipt",
        ["source", "received_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_webhook_receipt_source_received",
        table_name="elitedom_webhook_receipt",
    )
    op.drop_table("elitedom_webhook_receipt")

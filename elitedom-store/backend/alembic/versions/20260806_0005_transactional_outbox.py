"""Add the durable transactional integration outbox.

Revision ID: 0005_transactional_outbox
Revises: 0004_odoo_webhook_receipts
Create Date: 2026-08-06 03:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_transactional_outbox"
down_revision: str | None = "0004_odoo_webhook_receipts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_outbox_event",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column(
            "source_context",
            sa.String(length=64),
            nullable=False,
            server_default="application",
        ),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatched_task", sa.String(length=255), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index(
        "ix_elitedom_outbox_event_status_available",
        "elitedom_outbox_event",
        ["status", "available_at"],
        unique=False,
    )
    op.create_index(
        "ix_elitedom_outbox_event_source_created",
        "elitedom_outbox_event",
        ["source_context", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_outbox_event_source_created",
        table_name="elitedom_outbox_event",
    )
    op.drop_index(
        "ix_elitedom_outbox_event_status_available",
        table_name="elitedom_outbox_event",
    )
    op.drop_table("elitedom_outbox_event")

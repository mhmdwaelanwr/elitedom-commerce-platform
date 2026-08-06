"""Persist the priced order currency for payment reconciliation.

Revision ID: 0007_order_currency_refund
Revises: 0006_hybrid_dropship
Create Date: 2026-08-06 05:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# Alembic stores revision identifiers in VARCHAR(32) by default. Keep every
# identifier within that limit so upgrades can record the new head safely.
revision: str = "0007_order_currency_refund"
down_revision: str | None = "0006_hybrid_dropship"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Historical orders were priced in EGP. Retaining an explicit value on
    # each record allows a signed provider webhook to compare both amount and
    # tender currency rather than trusting a mutable environment setting.
    op.add_column(
        "sale_order",
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default=sa.text("'EGP'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("sale_order", "currency")

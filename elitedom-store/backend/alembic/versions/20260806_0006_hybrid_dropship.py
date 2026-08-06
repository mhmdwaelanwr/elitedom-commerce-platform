"""Add verified supplier catalogue mappings for hybrid dropship fulfillment.

Revision ID: 0006_hybrid_dropship
Revises: 0005_transactional_outbox
Create Date: 2026-08-06 04:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_hybrid_dropship"
down_revision: str | None = "0005_transactional_outbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing suppliers are intentionally unverified after the migration.
    # A historical contact record must not become an automatic dropship target
    # until an administrator explicitly validates it.
    op.add_column(
        "elitedom_supplier",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "elitedom_product_supplier",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("supplier_sku", sa.String(length=64), nullable=False),
        sa.Column("unit_cost_usd", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_id"], ["elitedom_supplier.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_id",
            "supplier_id",
            name="uq_elitedom_product_supplier_product_supplier",
        ),
    )
    op.create_index(
        "uq_elitedom_product_supplier_primary",
        "elitedom_product_supplier",
        ["product_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )
    op.create_index(
        "ix_elitedom_product_supplier_supplier_active",
        "elitedom_product_supplier",
        ["supplier_id", "is_active"],
        unique=False,
    )

    # A deterministic fulfillment key is unique only for system-created
    # dropship POs.  Manual procurement records retain their current freedom
    # to share a supplier and sales-order reference.
    op.add_column(
        "elitedom_purchase_order",
        sa.Column("fulfillment_key", sa.String(length=128), nullable=True),
    )
    op.create_unique_constraint(
        "uq_elitedom_purchase_order_fulfillment_key",
        "elitedom_purchase_order",
        ["fulfillment_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_elitedom_purchase_order_fulfillment_key",
        "elitedom_purchase_order",
        type_="unique",
    )
    op.drop_column("elitedom_purchase_order", "fulfillment_key")
    op.drop_index(
        "ix_elitedom_product_supplier_supplier_active",
        table_name="elitedom_product_supplier",
    )
    op.drop_index(
        "uq_elitedom_product_supplier_primary",
        table_name="elitedom_product_supplier",
    )
    op.drop_table("elitedom_product_supplier")
    op.drop_column("elitedom_supplier", "is_verified")

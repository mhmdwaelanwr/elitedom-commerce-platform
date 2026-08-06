"""Add customer-owned shipping addresses and persistent wishlist entries.

Revision ID: 0002_customer_portal
Revises: 0001_initial_schema
Create Date: 2026-08-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_customer_portal"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_customer_address",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False, server_default="Home"),
        sa.Column("recipient_name", sa.String(length=128), nullable=False),
        sa.Column("recipient_phone", sa.String(length=20), nullable=False),
        sa.Column("street_address", sa.Text(), nullable=False),
        sa.Column("address_line_2", sa.Text(), nullable=True),
        sa.Column("city", sa.String(length=64), nullable=False),
        sa.Column("governorate", sa.String(length=64), nullable=False),
        sa.Column("postal_code", sa.String(length=16), nullable=True),
        sa.Column("country", sa.String(length=64), nullable=False, server_default="Egypt"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_elitedom_customer_address_partner_default",
        "elitedom_customer_address",
        ["partner_id", "is_default"],
        unique=False,
    )

    op.create_table(
        "elitedom_wishlist_item",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "partner_id",
            "product_id",
            name="uq_elitedom_wishlist_item_partner_product",
        ),
    )
    op.create_index(
        "ix_elitedom_wishlist_item_partner_created",
        "elitedom_wishlist_item",
        ["partner_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_wishlist_item_partner_created",
        table_name="elitedom_wishlist_item",
    )
    op.drop_table("elitedom_wishlist_item")
    op.drop_index(
        "ix_elitedom_customer_address_partner_default",
        table_name="elitedom_customer_address",
    )
    op.drop_table("elitedom_customer_address")

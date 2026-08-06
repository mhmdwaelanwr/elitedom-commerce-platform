"""Initial schema for Elitedom Store ERP (all 11 entity groups).

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-01 22:30:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. res_currency
    op.create_table(
        "res_currency",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=8), nullable=False),
        sa.Column("symbol", sa.String(length=8), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. res_currency_rate
    op.create_table(
        "res_currency_rate",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("currency_id", sa.Integer(), nullable=False),
        sa.Column("rate", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column(
            "date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["currency_id"], ["res_currency.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. product_pricelist
    op.create_table(
        "product_pricelist",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. res_partner
    op.create_table(
        "res_partner",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("company_type", sa.String(length=32), nullable=False, server_default="person"),
        sa.Column("email", sa.String(length=128), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("pricelist_id", sa.Integer(), nullable=True),
        sa.Column(
            "is_dropship_vendor", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("mobile_fcm_token", sa.String(length=255), nullable=True),
        sa.Column("governorate", sa.String(length=64), nullable=True),
        sa.Column("street_address", sa.Text(), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="customer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["pricelist_id"], ["product_pricelist.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_res_partner_email"), "res_partner", ["email"], unique=True)
    op.create_index(op.f("ix_res_partner_phone"), "res_partner", ["phone"], unique=False)

    # 5. product_public_category
    op.create_table(
        "product_public_category",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["parent_id"], ["product_public_category.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        op.f("ix_product_public_category_name"), "product_public_category", ["name"], unique=False
    )

    # 6. product_template
    op.create_table(
        "product_template",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tracking", sa.String(length=32), nullable=False, server_default="serial"),
        sa.Column("base_cost_usd", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("target_margin_percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("list_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("brand", sa.String(length=128), nullable=True),
        sa.Column(
            "is_dropship_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("stock_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("weight_kg", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("warranty_months", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("socket_type", sa.String(length=32), nullable=True),
        sa.Column("ram_type", sa.String(length=32), nullable=True),
        sa.Column("form_factor", sa.String(length=32), nullable=True),
        sa.Column("power_wattage_draw", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pcie_gen", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["product_public_category.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_template_name"), "product_template", ["name"], unique=False)
    op.create_index(op.f("ix_product_template_sku"), "product_template", ["sku"], unique=True)
    op.create_index(
        "ix_product_brand_category", "product_template", ["brand", "category_id"], unique=False
    )

    # 7. product_image
    op.create_table(
        "product_image",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=False),
        sa.Column("alt_text", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. product_pricelist_item
    op.create_table(
        "product_pricelist_item",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pricelist_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("min_quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("discount_percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["pricelist_id"], ["product_pricelist.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 9. sale_order
    op.create_table(
        "sale_order",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column("payment_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("amount_subtotal", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "amount_shipping", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"
        ),
        sa.Column(
            "amount_tax", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"
        ),
        sa.Column("amount_total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("shipping_address", sa.Text(), nullable=False),
        sa.Column("shipping_governorate", sa.String(length=64), nullable=True),
        sa.Column("odoo_order_id", sa.Integer(), nullable=True),
        sa.Column("stripe_session_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("is_dropship", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        op.f("ix_sale_order_odoo_order_id"), "sale_order", ["odoo_order_id"], unique=False
    )

    # 10. sale_order_line
    op.create_table(
        "sale_order_line",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "discount_percent", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0"
        ),
        sa.Column("line_total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 11. stock_lot
    op.create_table(
        "stock_lot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("sale_order_id", sa.Integer(), nullable=True),
        sa.Column("warranty_expiration_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.ForeignKeyConstraint(["sale_order_id"], ["sale_order.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stock_lot_name"), "stock_lot", ["name"], unique=True)

    # 12. stock_picking
    op.create_table(
        "stock_picking",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=True),
        sa.Column("picking_type", sa.String(length=32), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("courier_tracking_ref", sa.String(length=128), nullable=True),
        sa.Column("supplier_po_ref", sa.String(length=64), nullable=True),
        sa.Column("scheduled_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["sale_id"], ["sale_order.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 13. elitedom_rma_ticket
    op.create_table(
        "elitedom_rma_ticket",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ticket_number", sa.String(length=64), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("serial_number", sa.String(length=128), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_media_url", sa.String(length=512), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending_review"),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"]),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_elitedom_rma_ticket_ticket_number"),
        "elitedom_rma_ticket",
        ["ticket_number"],
        unique=True,
    )

    # 14. elitedom_b2b_rfq
    op.create_table(
        "elitedom_b2b_rfq",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rfq_code", sa.String(length=64), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("items_payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="submitted"),
        sa.Column("validity_date", sa.Date(), nullable=True),
        sa.Column("total_estimated_value", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_elitedom_b2b_rfq_rfq_code"), "elitedom_b2b_rfq", ["rfq_code"], unique=True
    )

    # 15. elitedom_loyalty_ledger
    op.create_table(
        "elitedom_loyalty_ledger",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("points_delta", sa.Integer(), nullable=False),
        sa.Column("transaction_type", sa.String(length=32), nullable=False),
        sa.Column("reference_order_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.ForeignKeyConstraint(["reference_order_id"], ["sale_order.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 16. elitedom_hedera_audit
    op.create_table(
        "elitedom_hedera_audit",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transaction_ref", sa.String(length=128), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("payload_hash", sa.String(length=256), nullable=False),
        sa.Column("hedera_tx_id", sa.String(length=128), nullable=False),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hedera_tx_id"),
    )
    op.create_index(
        op.f("ix_elitedom_hedera_audit_transaction_ref"),
        "elitedom_hedera_audit",
        ["transaction_ref"],
        unique=False,
    )

    # 17. elitedom_supplier
    op.create_table(
        "elitedom_supplier",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=128), nullable=True),
        sa.Column("email", sa.String(length=128), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("lead_time_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("performance_rating", sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "defect_rate_percent",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 18. elitedom_purchase_order
    op.create_table(
        "elitedom_purchase_order",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("po_number", sa.String(length=64), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("sale_order_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("items_payload", sa.JSON(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="USD"),
        sa.Column("expected_delivery_date", sa.Date(), nullable=True),
        sa.Column("actual_delivery_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["sale_order_id"], ["sale_order.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["elitedom_supplier.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_elitedom_purchase_order_po_number"),
        "elitedom_purchase_order",
        ["po_number"],
        unique=True,
    )

    # 19. elitedom_cart
    op.create_table(
        "elitedom_cart",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_elitedom_cart_session_id"), "elitedom_cart", ["session_id"], unique=False
    )

    # 20. elitedom_cart_item
    op.create_table(
        "elitedom_cart_item",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cart_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["cart_id"], ["elitedom_cart.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["product_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 21. elitedom_support_ticket
    op.create_table(
        "elitedom_support_ticket",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ticket_number", sa.String(length=64), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False, server_default="general"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("assigned_to", sa.Integer(), nullable=True),
        sa.Column("related_order_id", sa.Integer(), nullable=True),
        sa.Column("related_rma_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"]),
        sa.ForeignKeyConstraint(["related_order_id"], ["sale_order.id"]),
        sa.ForeignKeyConstraint(["related_rma_id"], ["elitedom_rma_ticket.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_elitedom_support_ticket_ticket_number"),
        "elitedom_support_ticket",
        ["ticket_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("elitedom_support_ticket")
    op.drop_table("elitedom_cart_item")
    op.drop_table("elitedom_cart")
    op.drop_table("elitedom_purchase_order")
    op.drop_table("elitedom_supplier")
    op.drop_table("elitedom_hedera_audit")
    op.drop_table("elitedom_loyalty_ledger")
    op.drop_table("elitedom_b2b_rfq")
    op.drop_table("elitedom_rma_ticket")
    op.drop_table("stock_picking")
    op.drop_table("stock_lot")
    op.drop_table("sale_order_line")
    op.drop_table("sale_order")
    op.drop_table("product_pricelist_item")
    op.drop_table("product_image")
    op.drop_table("product_template")
    op.drop_table("product_public_category")
    op.drop_table("res_partner")
    op.drop_table("product_pricelist")
    op.drop_table("res_currency_rate")
    op.drop_table("res_currency")

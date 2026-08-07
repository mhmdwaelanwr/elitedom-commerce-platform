"""Add explicit inventory reservations and fulfilment lifecycle records.

Revision ID: 0010_fulfillment_lifecycle
Revises: 0009_paymob_payment_records
Create Date: 2026-08-07 12:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010_fulfillment_lifecycle"
down_revision: str | None = "0009_paymob_payment_records"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_inventory_source_balance",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("source_on_hand_qty", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.String(length=32),
            server_default="local_baseline",
            nullable=False,
        ),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["product_template.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("product_id"),
    )

    op.create_table(
        "elitedom_inventory_reservation",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.String(length=32), server_default="reserved", nullable=False
        ),
        sa.Column(
            "source_reconciled_quantity",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "reserved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["product_id"], ["product_template.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "order_id", "product_id", name="uq_inventory_reservation_order_product"
        ),
        sa.CheckConstraint("quantity > 0", name="ck_inventory_reservation_quantity_positive"),
        sa.CheckConstraint(
            "source_reconciled_quantity >= 0 AND source_reconciled_quantity <= quantity",
            name="ck_inventory_reservation_reconciled_range",
        ),
    )
    op.create_index(
        "ix_inventory_reservation_product_status",
        "elitedom_inventory_reservation",
        ["product_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_inventory_reservation_order_status",
        "elitedom_inventory_reservation",
        ["order_id", "status"],
        unique=False,
    )

    op.create_table(
        "elitedom_order_fulfillment",
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="payment_pending",
            nullable=False,
        ),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_to_ship_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("order_id"),
    )
    op.create_index(
        "ix_order_fulfillment_status",
        "elitedom_order_fulfillment",
        ["status"],
        unique=False,
    )

    op.create_table(
        "elitedom_shipment",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("supplier_po_id", sa.Integer(), nullable=True),
        sa.Column("shipment_key", sa.String(length=128), nullable=False),
        sa.Column("fulfillment_leg", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("carrier", sa.String(length=128), nullable=True),
        sa.Column("tracking_number", sa.String(length=128), nullable=True),
        sa.Column("external_reference", sa.String(length=128), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["sale_order.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["supplier_po_id"], ["elitedom_purchase_order.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shipment_key"),
    )
    op.create_index(
        "ix_shipment_order_status",
        "elitedom_shipment",
        ["order_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_shipment_tracking",
        "elitedom_shipment",
        ["tracking_number"],
        unique=False,
    )

    # Existing checkout already decremented stock for active local orders.  The
    # backfill captures those withheld units without mutating stock a second time.
    op.execute(
        sa.text(
            """
            INSERT INTO elitedom_inventory_reservation
                (order_id, product_id, quantity, status, source_reconciled_quantity, reserved_at)
            SELECT
                so.id,
                sol.product_id,
                SUM(sol.quantity),
                CASE
                    WHEN so.state = 'done' THEN 'consumed_pending_source'
                    ELSE 'reserved'
                END,
                0,
                COALESCE(so.created_at, now())
            FROM sale_order AS so
            JOIN sale_order_line AS sol ON sol.order_id = so.id
            JOIN product_template AS pt ON pt.id = sol.product_id
            WHERE so.stock_reservation_released = false
              AND so.state <> 'cancel'
              AND pt.is_dropship_enabled = false
            GROUP BY so.id, sol.product_id, so.state, so.created_at
            ON CONFLICT (order_id, product_id) DO NOTHING
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO elitedom_inventory_source_balance
                (product_id, source_on_hand_qty, source, updated_at)
            SELECT
                pt.id,
                pt.stock_qty + COALESCE(SUM(
                    CASE
                        WHEN ir.status IN ('reserved', 'consumed_pending_source')
                        THEN ir.quantity
                        ELSE 0
                    END
                ), 0),
                'migration_baseline',
                now()
            FROM product_template AS pt
            LEFT JOIN elitedom_inventory_reservation AS ir ON ir.product_id = pt.id
            GROUP BY pt.id, pt.stock_qty
            ON CONFLICT (product_id) DO NOTHING
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO elitedom_order_fulfillment
                (order_id, status, confirmed_at, shipped_at, cancelled_at, created_at)
            SELECT
                so.id,
                CASE
                    WHEN so.state = 'cancel' THEN 'cancelled'
                    WHEN so.state = 'done' THEN 'shipped'
                    WHEN so.state IN ('sale', 'sent') THEN 'confirmed'
                    ELSE 'payment_pending'
                END,
                CASE
                    WHEN so.state IN ('sale', 'sent', 'done')
                    THEN COALESCE(so.updated_at, so.created_at, now())
                    ELSE NULL
                END,
                CASE
                    WHEN so.state = 'done'
                    THEN COALESCE(sp.completed_date, so.updated_at, so.created_at, now())
                    ELSE NULL
                END,
                CASE
                    WHEN so.state = 'cancel'
                    THEN COALESCE(so.updated_at, so.created_at, now())
                    ELSE NULL
                END,
                COALESCE(so.created_at, now())
            FROM sale_order AS so
            LEFT JOIN LATERAL (
                SELECT picking.completed_date
                FROM stock_picking AS picking
                WHERE picking.sale_id = so.id
                ORDER BY picking.id DESC
                LIMIT 1
            ) AS sp ON true
            ON CONFLICT (order_id) DO NOTHING
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO elitedom_shipment
                (order_id, shipment_key, fulfillment_leg, status, tracking_number,
                 external_reference, scheduled_at, shipped_at, created_at)
            SELECT
                sp.sale_id,
                'legacy-picking:' || sp.id,
                CASE WHEN sp.picking_type = 'dropship' THEN 'dropship' ELSE 'local' END,
                CASE WHEN sp.state = 'done' THEN 'shipped' ELSE 'pending' END,
                sp.courier_tracking_ref,
                sp.name,
                sp.scheduled_date,
                CASE WHEN sp.state = 'done' THEN sp.completed_date ELSE NULL END,
                COALESCE(sp.created_at, now())
            FROM stock_picking AS sp
            WHERE sp.sale_id IS NOT NULL
              AND sp.picking_type IN ('outgoing', 'dropship')
            ON CONFLICT (shipment_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_shipment_tracking", table_name="elitedom_shipment")
    op.drop_index("ix_shipment_order_status", table_name="elitedom_shipment")
    op.drop_table("elitedom_shipment")

    op.drop_index("ix_order_fulfillment_status", table_name="elitedom_order_fulfillment")
    op.drop_table("elitedom_order_fulfillment")

    op.drop_index(
        "ix_inventory_reservation_order_status",
        table_name="elitedom_inventory_reservation",
    )
    op.drop_index(
        "ix_inventory_reservation_product_status",
        table_name="elitedom_inventory_reservation",
    )
    op.drop_table("elitedom_inventory_reservation")
    op.drop_table("elitedom_inventory_source_balance")

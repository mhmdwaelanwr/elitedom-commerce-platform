"""Add granular staff permission overrides and administrative audit trail.

Revision ID: 0011_admin_rbac_audit
Revises: 0010_fulfillment_lifecycle
Create Date: 2026-08-07 15:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_admin_rbac_audit"
down_revision: str | None = "0010_fulfillment_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_staff_permission_override",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("permission", sa.String(length=64), nullable=False),
        sa.Column("effect", sa.String(length=8), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "effect IN ('allow', 'deny')", name="ck_staff_permission_override_effect"
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"], ["res_partner.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["res_partner.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "partner_id",
            "permission",
            name="uq_staff_permission_override_partner_permission",
        ),
    )
    op.create_index(
        "ix_staff_permission_override_partner",
        "elitedom_staff_permission_override",
        ["partner_id"],
        unique=False,
    )

    op.create_table(
        "elitedom_admin_audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_partner_id", sa.Integer(), nullable=True),
        sa.Column("actor_role", sa.String(length=32), nullable=True),
        sa.Column("action", sa.String(length=96), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=True),
        sa.Column("before_summary", sa.JSON(), nullable=True),
        sa.Column("after_summary", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("request_method", sa.String(length=12), nullable=True),
        sa.Column("request_path", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_partner_id"], ["res_partner.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_admin_audit_actor_created",
        "elitedom_admin_audit_log",
        ["actor_partner_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_admin_audit_entity_created",
        "elitedom_admin_audit_log",
        ["entity_type", "entity_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_admin_audit_action_created",
        "elitedom_admin_audit_log",
        ["action", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_admin_audit_action_created", table_name="elitedom_admin_audit_log")
    op.drop_index("ix_admin_audit_entity_created", table_name="elitedom_admin_audit_log")
    op.drop_index("ix_admin_audit_actor_created", table_name="elitedom_admin_audit_log")
    op.drop_table("elitedom_admin_audit_log")
    op.drop_index(
        "ix_staff_permission_override_partner",
        table_name="elitedom_staff_permission_override",
    )
    op.drop_table("elitedom_staff_permission_override")

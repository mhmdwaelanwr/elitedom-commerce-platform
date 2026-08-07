"""Add release-scoped auditable launch acceptance gates.

Revision ID: 0014_launch_acceptance
Revises: 0013_staff_mfa
Create Date: 2026-08-07 20:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_launch_acceptance"
down_revision: str | None = "0013_staff_mfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_launch_acceptance",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("release_ref", sa.String(length=128), nullable=False),
        sa.Column("environment", sa.String(length=16), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("evidence_ref", sa.String(length=512), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("verified_by", sa.Integer(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'passed', 'failed', 'waived')",
            name="ck_launch_acceptance_status",
        ),
        sa.ForeignKeyConstraint(["verified_by"], ["res_partner.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "release_ref",
            "environment",
            "key",
            name="uq_launch_acceptance_release_environment_key",
        ),
    )
    op.create_index(
        "ix_launch_acceptance_release_environment",
        "elitedom_launch_acceptance",
        ["release_ref", "environment"],
        unique=False,
    )
    op.create_index(
        "ix_launch_acceptance_status",
        "elitedom_launch_acceptance",
        ["release_ref", "environment", "status"],
        unique=False,
    )
    op.create_index(
        "ix_launch_acceptance_verified",
        "elitedom_launch_acceptance",
        ["verified_by", "verified_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_launch_acceptance_verified", table_name="elitedom_launch_acceptance")
    op.drop_index("ix_launch_acceptance_status", table_name="elitedom_launch_acceptance")
    op.drop_index(
        "ix_launch_acceptance_release_environment",
        table_name="elitedom_launch_acceptance",
    )
    op.drop_table("elitedom_launch_acceptance")

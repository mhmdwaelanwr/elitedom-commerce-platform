"""Add staff MFA credentials and per-session verification state.

Revision ID: 0013_staff_mfa
Revises: 0012_catalog_content_media
Create Date: 2026-08-07 19:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_staff_mfa"
down_revision: str | None = "0012_catalog_content_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "elitedom_auth_session",
        sa.Column("mfa_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "elitedom_admin_mfa_credential",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("recovery_code_hashes", sa.Text(), server_default="[]", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partner_id"),
    )
    op.create_index(
        "ix_elitedom_admin_mfa_credential_partner_id",
        "elitedom_admin_mfa_credential",
        ["partner_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_elitedom_admin_mfa_credential_partner_id",
        table_name="elitedom_admin_mfa_credential",
    )
    op.drop_table("elitedom_admin_mfa_credential")
    op.drop_column("elitedom_auth_session", "mfa_verified_at")

"""Add revocable auth sessions, linked identities, and phone OTP challenges.

Revision ID: 0008_auth_sessions_otp
Revises: 0007_order_currency_refund
Create Date: 2026-08-07 01:35:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_auth_sessions_otp"
down_revision: str | None = "0007_order_currency_refund"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "elitedom_auth_identity",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "subject",
            name="uq_auth_identity_provider_subject",
        ),
        sa.UniqueConstraint(
            "partner_id",
            "provider",
            name="uq_auth_identity_partner_provider",
        ),
    )
    op.create_index(
        "ix_elitedom_auth_identity_partner_id",
        "elitedom_auth_identity",
        ["partner_id"],
        unique=False,
    )

    op.create_table(
        "elitedom_auth_session",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("auth_method", sa.String(length=32), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoke_reason", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["res_partner.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_elitedom_auth_session_partner_id",
        "elitedom_auth_session",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        "ix_auth_session_partner_active",
        "elitedom_auth_session",
        ["partner_id", "revoked_at", "expires_at"],
        unique=False,
    )

    op.create_table(
        "elitedom_otp_challenge",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("mobile", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("request_ip", sa.String(length=64), nullable=True),
        sa.Column("requested_name", sa.String(length=128), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_elitedom_otp_challenge_mobile",
        "elitedom_otp_challenge",
        ["mobile"],
        unique=False,
    )
    op.create_index(
        "ix_otp_challenge_mobile_created",
        "elitedom_otp_challenge",
        ["mobile", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_otp_challenge_mobile_created", table_name="elitedom_otp_challenge")
    op.drop_index("ix_elitedom_otp_challenge_mobile", table_name="elitedom_otp_challenge")
    op.drop_table("elitedom_otp_challenge")

    op.drop_index("ix_auth_session_partner_active", table_name="elitedom_auth_session")
    op.drop_index("ix_elitedom_auth_session_partner_id", table_name="elitedom_auth_session")
    op.drop_table("elitedom_auth_session")

    op.drop_index("ix_elitedom_auth_identity_partner_id", table_name="elitedom_auth_identity")
    op.drop_table("elitedom_auth_identity")

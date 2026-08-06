"""Persistent authentication state for identities, sessions, and phone OTP."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuthIdentity(Base):
    """A verified external or phone identity linked to one customer account."""

    __tablename__ = "elitedom_auth_identity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("res_partner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    partner = relationship("Partner")

    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),
        UniqueConstraint("partner_id", "provider", name="uq_auth_identity_partner_provider"),
    )


class AuthSession(Base):
    """A revocable browser/device session with a rotating refresh credential."""

    __tablename__ = "elitedom_auth_session"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    partner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("res_partner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    auth_method: Mapped[str] = mapped_column(String(32), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)

    partner = relationship("Partner")

    __table_args__ = (
        Index("ix_auth_session_partner_active", "partner_id", "revoked_at", "expires_at"),
    )


class OtpChallenge(Base):
    """A short-lived, single-use phone verification challenge."""

    __tablename__ = "elitedom_otp_challenge"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    request_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requested_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_otp_challenge_mobile_created", "mobile", "created_at"),
    )

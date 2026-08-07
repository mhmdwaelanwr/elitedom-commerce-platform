"""Finance, procurement, and safe integration-readiness services for the admin console."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings, is_https_url, is_safe_service_url, is_secure_secret
from app.models import Partner, SaleOrder
from app.modules.admin.control_schemas import (
    AdminIntegrationCheck,
    AdminIntegrationStatus,
    AdminIntegrationStatusResponse,
    AdminPaymentAttemptItem,
    AdminPaymentAttemptListResponse,
    AdminRefundItem,
    AdminRefundListResponse,
    AdminRefundRequestResponse,
    AdminRuntimeConfiguration,
)
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.refunds import ensure_full_refund_request
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.schemas import PaymentStatus

settings = get_settings()


class AdminControlPlaneService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_payments(
        self,
        *,
        page: int,
        limit: int,
        status: str | None = None,
        provider: str | None = None,
        query: str | None = None,
    ) -> AdminPaymentAttemptListResponse:
        filters = []
        if status:
            filters.append(PaymentAttempt.status == status)
        if provider:
            filters.append(PaymentAttempt.provider == provider)
        if query:
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    SaleOrder.name.ilike(pattern),
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                    PaymentAttempt.provider_transaction_id.ilike(pattern),
                    PaymentAttempt.provider_intention_id.ilike(pattern),
                )
            )

        base = (
            select(PaymentAttempt, SaleOrder, Partner)
            .join(SaleOrder, SaleOrder.id == PaymentAttempt.order_id)
            .join(Partner, Partner.id == SaleOrder.partner_id)
            .where(*filters)
        )
        total = int(
            await self.db.scalar(
                select(func.count(PaymentAttempt.id))
                .join(SaleOrder, SaleOrder.id == PaymentAttempt.order_id)
                .join(Partner, Partner.id == SaleOrder.partner_id)
                .where(*filters)
            )
            or 0
        )
        rows = (
            await self.db.execute(
                base.order_by(PaymentAttempt.created_at.desc(), PaymentAttempt.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminPaymentAttemptListResponse(
            payments=[
                AdminPaymentAttemptItem(
                    id=attempt.id,
                    order_id=order.id,
                    order_number=order.name,
                    customer_name=partner.name,
                    customer_email=partner.email,
                    provider=attempt.provider,
                    payment_method=attempt.payment_method,
                    status=attempt.status,
                    amount_minor=attempt.amount_minor,
                    currency=attempt.currency,
                    provider_intention_id=attempt.provider_intention_id,
                    provider_transaction_id=attempt.provider_transaction_id,
                    failure_code=attempt.failure_code,
                    created_at=attempt.created_at,
                    completed_at=attempt.completed_at,
                )
                for attempt, order, partner in rows
            ],
            total_count=total,
            page=page,
            limit=limit,
        )

    async def list_refunds(
        self,
        *,
        page: int,
        limit: int,
        status: str | None = None,
        provider: str | None = None,
        query: str | None = None,
    ) -> AdminRefundListResponse:
        filters = []
        if status:
            filters.append(PaymentRefund.status == status)
        if provider:
            filters.append(PaymentRefund.provider == provider)
        if query:
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    SaleOrder.name.ilike(pattern),
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                    PaymentRefund.provider_refund_id.ilike(pattern),
                    PaymentRefund.reason.ilike(pattern),
                )
            )

        total = int(
            await self.db.scalar(
                select(func.count(PaymentRefund.id))
                .join(SaleOrder, SaleOrder.id == PaymentRefund.order_id)
                .join(Partner, Partner.id == SaleOrder.partner_id)
                .where(*filters)
            )
            or 0
        )
        rows = (
            await self.db.execute(
                select(PaymentRefund, SaleOrder, Partner)
                .join(SaleOrder, SaleOrder.id == PaymentRefund.order_id)
                .join(Partner, Partner.id == SaleOrder.partner_id)
                .where(*filters)
                .order_by(PaymentRefund.created_at.desc(), PaymentRefund.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminRefundListResponse(
            refunds=[
                AdminRefundItem(
                    id=refund.id,
                    order_id=order.id,
                    order_number=order.name,
                    customer_name=partner.name,
                    customer_email=partner.email,
                    provider=refund.provider,
                    amount_minor=refund.amount_minor,
                    currency=refund.currency,
                    status=refund.status,
                    reason=refund.reason,
                    provider_refund_id=refund.provider_refund_id,
                    failure_code=refund.failure_code,
                    created_at=refund.created_at,
                    completed_at=refund.completed_at,
                )
                for refund, order, partner in rows
            ],
            total_count=total,
            page=page,
            limit=limit,
        )

    async def request_full_refund(
        self,
        *,
        order_id: int,
        reason: str,
    ) -> AdminRefundRequestResponse:
        order = await self.db.scalar(
            select(SaleOrder).where(SaleOrder.id == order_id).with_for_update()
        )
        if order is None:
            raise ResourceNotFoundError("SaleOrder", order_id)
        if order.payment_status not in {
            PaymentStatus.PAID.value,
            PaymentStatus.REFUND_REQUESTED.value,
        }:
            raise ResourceConflictError(
                "Refunds can only be requested for paid orders. "
                f"Current status: {order.payment_status}."
            )
        attempt = await self.db.scalar(
            select(PaymentAttempt)
            .where(PaymentAttempt.order_id == order.id)
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )
        if attempt is not None and attempt.status != "succeeded":
            raise ResourceConflictError(
                f"The latest provider payment attempt is not refundable: {attempt.status}."
            )
        refund, created = await ensure_full_refund_request(
            db=self.db,
            order=order,
            attempt=attempt,
            reason=reason,
            source_context="admin_control_plane",
        )
        return AdminRefundRequestResponse(
            refund_id=refund.id,
            order_id=order.id,
            order_number=order.name,
            provider=refund.provider,
            status=refund.status,
            amount_minor=refund.amount_minor,
            currency=refund.currency,
            created=created,
        )

    def integration_status(self) -> AdminIntegrationStatusResponse:
        integrations = [
            self._integration(
                key="odoo",
                label="Odoo 17",
                enabled=settings.odoo_sync_enabled or settings.odoo_webhooks_enabled,
                checks={
                    "service_url": is_safe_service_url(settings.odoo_url),
                    "database": bool(settings.odoo_db.strip()),
                    "api_user": bool(settings.odoo_api_user.strip()),
                    "api_key": is_secure_secret(settings.odoo_api_key, minimum_length=16),
                    "webhook_secret": (
                        not settings.odoo_webhooks_enabled
                        or is_secure_secret(settings.odoo_webhook_secret)
                    ),
                },
            ),
            self._integration(
                key="paymob",
                label="Paymob",
                enabled=settings.paymob_enabled,
                checks={
                    "secret_key": is_secure_secret(settings.paymob_secret_key, minimum_length=20),
                    "public_key": is_secure_secret(settings.paymob_public_key, minimum_length=20),
                    "hmac_secret": is_secure_secret(settings.paymob_hmac_secret),
                    "card_method": settings.paymob_card_payment_method_id > 0,
                    "wallet_method": settings.paymob_wallet_payment_method_id > 0,
                    "notification_url": is_https_url(settings.paymob_notification_url),
                    "redirection_url": is_https_url(settings.paymob_redirection_url),
                },
            ),
            self._integration(
                key="google_oauth",
                label="Google Sign-In",
                enabled=bool(settings.google_oauth_client_id.strip()),
                checks={"client_id": bool(settings.google_oauth_client_id.strip())},
            ),
            self._integration(
                key="apple_oauth",
                label="Apple Sign-In",
                enabled=bool(settings.apple_oauth_client_id.strip()),
                checks={"client_id": bool(settings.apple_oauth_client_id.strip())},
            ),
            self._integration(
                key="twilio",
                label="Twilio OTP",
                enabled=bool(
                    settings.twilio_account_sid.strip()
                    or settings.twilio_messaging_service_sid.strip()
                ),
                checks={
                    "account_sid": bool(settings.twilio_account_sid.strip()),
                    "auth_token": is_secure_secret(settings.twilio_auth_token, minimum_length=16),
                    "sender": bool(
                        settings.twilio_phone_number.strip()
                        or settings.twilio_messaging_service_sid.strip()
                    ),
                },
            ),
            self._integration(
                key="email",
                label="Transactional email",
                enabled=settings.sendgrid_enabled or settings.zeptomail_enabled,
                checks={
                    "sendgrid": (
                        not settings.sendgrid_enabled
                        or is_secure_secret(settings.sendgrid_api_key, minimum_length=20)
                    ),
                    "zeptomail": (
                        not settings.zeptomail_enabled
                        or is_secure_secret(settings.zeptomail_api_key, minimum_length=20)
                    ),
                },
            ),
        ]
        return AdminIntegrationStatusResponse(
            integrations=integrations,
            runtime=AdminRuntimeConfiguration(
                environment=settings.environment,
                debug=settings.debug,
                metrics_enabled=settings.metrics_enabled,
                app_version=settings.app_version,
                allowed_host_count=len(
                    [host for host in settings.allowed_hosts.split(",") if host.strip()]
                ),
                cors_origin_count=len(settings.cors_origin_list),
                trusted_proxy_count=len(settings.trusted_proxy_ip_set),
                media_public_path=settings.media_public_path,
            ),
        )

    @staticmethod
    def _integration(
        *,
        key: str,
        label: str,
        enabled: bool,
        checks: dict[str, bool],
    ) -> AdminIntegrationStatus:
        status = "disabled" if not enabled else ("ready" if all(checks.values()) else "incomplete")
        return AdminIntegrationStatus(
            key=key,
            label=label,
            enabled=enabled,
            status=status,
            checks=[
                AdminIntegrationCheck(
                    key=check_key,
                    label=check_key.replace("_", " ").title(),
                    configured=configured,
                )
                for check_key, configured in checks.items()
            ],
        )

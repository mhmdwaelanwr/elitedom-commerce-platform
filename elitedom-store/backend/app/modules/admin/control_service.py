"""Finance, procurement, integration, and launch-readiness services for the admin console."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    get_settings,
    is_https_url,
    is_safe_service_url,
    is_secure_secret,
)
from app.models import Partner, SaleOrder
from app.modules.admin.control_schemas import (
    AdminIntegrationCheck,
    AdminIntegrationStatus,
    AdminIntegrationStatusResponse,
    AdminLaunchGate,
    AdminLaunchGateUpdate,
    AdminLaunchReadinessResponse,
    AdminPaymentAttemptItem,
    AdminPaymentAttemptListResponse,
    AdminRefundItem,
    AdminRefundListResponse,
    AdminRefundRequestResponse,
    AdminRuntimeConfiguration,
)
from app.modules.admin.models import LaunchAcceptance
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.modules.payments.refunds import ensure_full_refund_request
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.schemas import PaymentStatus

settings = get_settings()

_MANUAL_LAUNCH_GATES: tuple[tuple[str, str, str, bool], ...] = (
    ("uat_english", "English storefront UAT", "experience", True),
    ("uat_arabic_rtl", "Arabic and RTL storefront UAT", "experience", True),
    ("responsive_accessibility", "Responsive and accessibility smoke", "experience", True),
    ("paymob_live_flow", "Paymob payment, webhook, and refund acceptance", "providers", True),
    ("google_oauth_live", "Google Sign-In provider acceptance", "providers", True),
    ("apple_oauth_live", "Apple Sign-In provider acceptance", "providers", True),
    ("twilio_otp_live", "Phone OTP provider acceptance", "providers", True),
    ("odoo_round_trip", "Odoo order and stock round-trip acceptance", "operations", True),
    ("fulfillment_refund", "Fulfillment, delivery, return, and refund UAT", "operations", True),
    ("backup_restore", "PostgreSQL backup and restore drill", "operations", True),
    ("monitoring_alerts", "Metrics, logs, tracing, and alert routing verified", "operations", True),
    ("rollback_drill", "Release rollback drill", "operations", True),
)


class AdminControlPlaneService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def launch_readiness(
        self,
        *,
        release_ref: str,
    ) -> AdminLaunchReadinessResponse:
        scoped_release = self._normalize_release_ref(release_ref)
        integration_response = self.integration_status()
        integrations = {item.key: item for item in integration_response.integrations}

        hosts = [host.strip() for host in settings.allowed_hosts.split(",") if host.strip()]
        cors_origins = settings.cors_origin_list
        gates: list[AdminLaunchGate] = [
            self._automatic_launch_gate(
                key="release_identity",
                label="Release candidate explicitly scoped",
                category="deployment",
                passed=True,
                detail=f"Launch evidence is scoped to release {scoped_release} in {settings.environment}.",
            ),
            self._automatic_launch_gate(
                key="production_environment",
                label="Production environment selected",
                category="deployment",
                passed=settings.environment == "production",
                detail=(
                    "Runtime environment is production."
                    if settings.environment == "production"
                    else f"Runtime environment is {settings.environment}; production is required for launch."
                ),
            ),
            self._automatic_launch_gate(
                key="debug_disabled",
                label="Debug mode disabled",
                category="security",
                passed=not settings.debug,
                detail="Debug mode is disabled." if not settings.debug else "Debug mode must be disabled.",
            ),
            self._automatic_launch_gate(
                key="staff_mfa",
                label="Staff MFA enforced",
                category="security",
                passed=settings.staff_mfa_required,
                detail=(
                    "Staff MFA enforcement is enabled."
                    if settings.staff_mfa_required
                    else "Staff MFA must be enforced for launch."
                ),
            ),
            self._automatic_launch_gate(
                key="distributed_rate_limit",
                label="Distributed rate limiting enabled",
                category="security",
                passed=settings.rate_limit_backend == "redis",
                detail=(
                    "Redis-backed rate limiting is enabled."
                    if settings.rate_limit_backend == "redis"
                    else "Production launch requires Redis-backed rate limiting."
                ),
            ),
            self._automatic_launch_gate(
                key="metrics_protected",
                label="Metrics access protected",
                category="observability",
                passed=(
                    not settings.metrics_enabled
                    or is_secure_secret(settings.metrics_bearer_token)
                ),
                detail=(
                    "Metrics are disabled or protected with a deployment secret."
                    if (
                        not settings.metrics_enabled
                        or is_secure_secret(settings.metrics_bearer_token)
                    )
                    else "Metrics are enabled without a strong access token."
                ),
            ),
            self._automatic_launch_gate(
                key="allowed_hosts_scoped",
                label="Allowed hosts scoped",
                category="security",
                passed=bool(hosts) and "*" not in hosts,
                detail=(
                    "Allowed hosts are explicitly scoped."
                    if bool(hosts) and "*" not in hosts
                    else "Allowed hosts must be explicit and must not contain a wildcard."
                ),
            ),
            self._automatic_launch_gate(
                key="cors_https_scoped",
                label="CORS origins scoped to HTTPS",
                category="security",
                passed=(
                    bool(cors_origins)
                    and "*" not in cors_origins
                    and all(is_https_url(origin) for origin in cors_origins)
                ),
                detail=(
                    "CORS origins are explicit HTTPS origins."
                    if (
                        bool(cors_origins)
                        and "*" not in cors_origins
                        and all(is_https_url(origin) for origin in cors_origins)
                    )
                    else "Launch requires explicit HTTPS CORS origins."
                ),
            ),
            self._integration_launch_gate(integrations["paymob"], required=True),
            self._integration_launch_gate(integrations["google_oauth"], required=True),
            self._integration_launch_gate(integrations["apple_oauth"], required=True),
            self._integration_launch_gate(integrations["twilio"], required=True),
            self._integration_launch_gate(integrations["odoo"], required=True),
            self._integration_launch_gate(
                integrations["email"],
                required=False,
                category="communications",
            ),
            self._automatic_launch_gate(
                key="media_delivery",
                label="Object storage and CDN configured",
                category="performance",
                passed=(
                    settings.media_storage_provider == "s3"
                    and is_https_url(settings.media_cdn_base_url)
                ),
                required=False,
                detail=(
                    "S3-compatible media storage is served through an HTTPS CDN."
                    if (
                        settings.media_storage_provider == "s3"
                        and is_https_url(settings.media_cdn_base_url)
                    )
                    else "Local media storage is valid for single-node operation but is a scaling warning."
                ),
            ),
            self._automatic_launch_gate(
                key="otel_export",
                label="Distributed tracing exporter configured",
                category="observability",
                passed=(
                    bool(settings.otel_exporter_otlp_endpoint.strip())
                    and is_safe_service_url(settings.otel_exporter_otlp_endpoint)
                ),
                required=False,
                detail=(
                    "An OpenTelemetry exporter endpoint is configured."
                    if (
                        bool(settings.otel_exporter_otlp_endpoint.strip())
                        and is_safe_service_url(settings.otel_exporter_otlp_endpoint)
                    )
                    else "Tracing export is not configured; structured logs and metrics remain available."
                ),
            ),
        ]

        persisted = {
            item.key: item
            for item in (
                await self.db.scalars(
                    select(LaunchAcceptance).where(
                        LaunchAcceptance.release_ref == scoped_release,
                        LaunchAcceptance.environment == settings.environment,
                    )
                )
            ).all()
        }
        for key, label, category, required in _MANUAL_LAUNCH_GATES:
            record = persisted.get(key)
            status = record.status if record is not None else "pending"
            if status == "passed":
                result = "pass"
                detail = "Operator acceptance is recorded with supporting evidence for this release."
            elif status == "waived":
                result = "warn"
                detail = "This launch gate was waived for this release and must be reviewed before release approval."
            elif status == "failed":
                result = "block" if required else "warn"
                detail = "The latest operator acceptance for this release failed."
            else:
                result = "block" if required else "warn"
                detail = "Operator acceptance has not been completed for this release."
            gates.append(
                AdminLaunchGate(
                    key=key,
                    label=label,
                    category=category,
                    source="operator",
                    required=required,
                    status=status,
                    result=result,
                    detail=detail,
                    evidence_ref=record.evidence_ref if record else None,
                    notes=record.notes if record else None,
                    verified_by=record.verified_by if record else None,
                    verified_at=record.verified_at if record else None,
                )
            )

        blocker_count = sum(gate.result == "block" for gate in gates)
        warning_count = sum(gate.result == "warn" for gate in gates)
        overall_status = (
            "blocked"
            if blocker_count
            else ("conditional" if warning_count else "ready")
        )
        return AdminLaunchReadinessResponse(
            release_ref=scoped_release,
            environment=settings.environment,
            overall_status=overall_status,
            blocker_count=blocker_count,
            warning_count=warning_count,
            generated_at=datetime.now(UTC),
            gates=gates,
        )

    async def update_launch_gate(
        self,
        *,
        release_ref: str,
        gate_key: str,
        payload: AdminLaunchGateUpdate,
        verified_by: int,
    ) -> tuple[LaunchAcceptance, dict[str, object] | None]:
        scoped_release = self._normalize_release_ref(release_ref)
        definition = next(
            (item for item in _MANUAL_LAUNCH_GATES if item[0] == gate_key),
            None,
        )
        if definition is None:
            raise ResourceNotFoundError("Launch gate", gate_key)

        evidence = payload.evidence_ref.strip() if payload.evidence_ref else None
        notes = payload.notes.strip() if payload.notes else None
        if payload.status == "passed" and not evidence:
            raise ResourceConflictError(
                "Passing a launch gate requires an evidence reference."
            )
        if payload.status == "waived" and not notes:
            raise ResourceConflictError(
                "Waiving a launch gate requires operator notes explaining the exception."
            )

        record = await self.db.scalar(
            select(LaunchAcceptance)
            .where(
                LaunchAcceptance.release_ref == scoped_release,
                LaunchAcceptance.environment == settings.environment,
                LaunchAcceptance.key == gate_key,
            )
            .with_for_update()
        )
        before = None
        if record is not None:
            before = {
                "release_ref": record.release_ref,
                "environment": record.environment,
                "status": record.status,
                "evidence_ref": record.evidence_ref,
                "notes": record.notes,
                "verified_by": record.verified_by,
                "verified_at": record.verified_at,
            }
        else:
            record = LaunchAcceptance(
                release_ref=scoped_release,
                environment=settings.environment,
                key=gate_key,
            )
            self.db.add(record)

        record.status = payload.status
        record.evidence_ref = evidence
        record.notes = notes
        if payload.status == "pending":
            record.verified_by = None
            record.verified_at = None
        else:
            record.verified_by = verified_by
            record.verified_at = datetime.now(UTC)
        await self.db.flush()
        return record, before

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
    def _normalize_release_ref(release_ref: str) -> str:
        normalized = release_ref.strip()
        if len(normalized) < 7 or len(normalized) > 128:
            raise ResourceConflictError(
                "Release reference must contain between 7 and 128 characters."
            )
        if any(character.isspace() for character in normalized):
            raise ResourceConflictError(
                "Release reference must not contain whitespace."
            )
        return normalized

    @staticmethod
    def _automatic_launch_gate(
        *,
        key: str,
        label: str,
        category: str,
        passed: bool,
        detail: str,
        required: bool = True,
    ) -> AdminLaunchGate:
        return AdminLaunchGate(
            key=key,
            label=label,
            category=category,
            source="configuration",
            required=required,
            status="automatic",
            result="pass" if passed else ("block" if required else "warn"),
            detail=detail,
        )

    @classmethod
    def _integration_launch_gate(
        cls,
        integration: AdminIntegrationStatus,
        *,
        required: bool,
        category: str = "providers",
    ) -> AdminLaunchGate:
        ready = integration.enabled and integration.status == "ready"
        return cls._automatic_launch_gate(
            key=f"integration_{integration.key}",
            label=f"{integration.label} configuration ready",
            category=category,
            passed=ready,
            required=required,
            detail=(
                f"{integration.label} is enabled and configuration-complete."
                if ready
                else (
                    f"{integration.label} is disabled or incomplete."
                    if required
                    else f"{integration.label} is optional and is not fully ready."
                )
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

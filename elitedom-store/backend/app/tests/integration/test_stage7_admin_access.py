"""Stage 7 integration coverage for current-state RBAC and administrative audit."""

from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Partner, SaleOrder
from app.modules.admin.models import AdminAuditLog, StaffPermissionOverride
from app.modules.payments.models import PaymentAttempt
from app.shared.security import create_access_token

pytestmark = pytest.mark.asyncio


def _authorization(partner: Partner, *, token_role: str | None = None) -> dict[str, str]:
    token = create_access_token(
        {
            "sub": str(partner.id),
            "email": partner.email,
            "role": token_role or partner.role,
        }
    )
    return {"Authorization": f"Bearer {token}"}


async def _partner(db_session, *, email: str, role: str) -> Partner:
    partner = Partner(
        name=email.split("@", 1)[0],
        email=email,
        phone=f"010{abs(hash(email)) % 10_000_000:07d}",
        role=role,
        company_type="person",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    return partner


async def test_persisted_role_beats_stale_system_admin_token(client, db_session):
    customer = await _partner(db_session, email="customer-stage7@example.com", role="customer")

    response = await client.get(
        "/api/v1/admin/access/me",
        headers=_authorization(customer, token_role="system_admin"),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "ELITE_1003"


async def test_explicit_deny_override_blocks_role_default(client, db_session):
    support = await _partner(
        db_session,
        email="support-stage7@example.com",
        role="customer_support",
    )
    db_session.add(
        StaffPermissionOverride(
            partner_id=support.id,
            permission="orders.view",
            effect="deny",
            created_by=support.id,
        )
    )
    await db_session.flush()

    access_response = await client.get(
        "/api/v1/admin/access/me",
        headers=_authorization(support),
    )
    orders_response = await client.get(
        "/api/v1/admin/orders",
        headers=_authorization(support),
    )

    assert access_response.status_code == 200
    assert "orders.view" not in access_response.json()["permissions"]
    assert orders_response.status_code == 403


async def test_system_admin_can_promote_staff_and_audit_the_change(client, db_session):
    admin = await _partner(db_session, email="admin-stage7@example.com", role="system_admin")
    target = await _partner(db_session, email="ops-stage7@example.com", role="customer")

    response = await client.put(
        f"/api/v1/admin/staff/{target.id}/access",
        headers=_authorization(admin),
        json={
            "role": "operations_manager",
            "overrides": [
                {"permission": "inventory.adjust", "effect": "allow"},
                {"permission": "payments.refund", "effect": "deny"},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "operations_manager"
    assert "inventory.adjust" in body["permissions"]
    assert "payments.refund" not in body["permissions"]

    persisted_target = await db_session.scalar(select(Partner).where(Partner.id == target.id))
    assert persisted_target is not None
    assert persisted_target.role == "operations_manager"

    audit = await db_session.scalar(
        select(AdminAuditLog).where(
            AdminAuditLog.action == "staff.access.update",
            AdminAuditLog.entity_id == str(target.id),
        )
    )
    assert audit is not None
    assert audit.actor_partner_id == admin.id
    assert audit.before_summary["role"] == "customer"
    assert audit.after_summary["role"] == "operations_manager"


async def test_last_active_system_admin_cannot_be_demoted(client, db_session):
    admin = await _partner(db_session, email="sole-admin-stage7@example.com", role="system_admin")

    response = await client.put(
        f"/api/v1/admin/staff/{admin.id}/access",
        headers=_authorization(admin),
        json={"role": "operations_manager", "overrides": []},
    )

    assert response.status_code == 409
    assert "system administrator" in response.json()["detail"]["message"].lower()


async def test_finance_control_plane_uses_persisted_permission_not_token_claim(
    client,
    db_session,
):
    customer = await _partner(
        db_session,
        email="fake-finance-stage7@example.com",
        role="customer",
    )
    finance = await _partner(
        db_session,
        email="finance-stage7@example.com",
        role="finance_officer",
    )

    stale_claim = await client.get(
        "/api/v1/admin/payments",
        headers=_authorization(customer, token_role="finance_officer"),
    )
    finance_response = await client.get(
        "/api/v1/admin/payments",
        headers=_authorization(finance),
    )

    assert stale_claim.status_code == 403
    assert finance_response.status_code == 200
    assert finance_response.json()["payments"] == []


async def test_integration_readiness_never_returns_secret_configuration_fields(
    client,
    db_session,
):
    admin = await _partner(
        db_session,
        email="integration-admin-stage7@example.com",
        role="system_admin",
    )

    response = await client.get(
        "/api/v1/admin/integrations",
        headers=_authorization(admin),
    )

    assert response.status_code == 200
    body = response.json()
    serialized = response.text.lower()
    for sensitive_field in (
        "paymob_secret_key",
        "paymob_public_key",
        "paymob_hmac_secret",
        "odoo_api_key",
        "odoo_webhook_secret",
        "twilio_auth_token",
        "sendgrid_api_key",
        "zeptomail_api_key",
        "jwt_secret_key",
    ):
        assert sensitive_field not in serialized
    assert body["integrations"]
    for integration in body["integrations"]:
        assert set(integration) == {"key", "label", "enabled", "status", "checks"}
        for check in integration["checks"]:
            assert isinstance(check["configured"], bool)


async def test_admin_full_refund_request_is_idempotent_and_audited(client, db_session):
    customer = await _partner(
        db_session,
        email="refund-customer-stage7@example.com",
        role="customer",
    )
    finance = await _partner(
        db_session,
        email="refund-finance-stage7@example.com",
        role="finance_officer",
    )
    order = SaleOrder(
        name="SO-STAGE7-REFUND",
        partner_id=customer.id,
        state="sale",
        payment_method="credit_card",
        payment_status="paid",
        amount_subtotal=Decimal("100.00"),
        amount_shipping=Decimal("0.00"),
        amount_tax=Decimal("0.00"),
        amount_total=Decimal("100.00"),
        currency="EGP",
        shipping_address="Cairo",
        shipping_governorate="Cairo",
        is_dropship=False,
    )
    db_session.add(order)
    await db_session.flush()
    attempt = PaymentAttempt(
        order_id=order.id,
        provider="paymob",
        payment_method="credit_card",
        status="succeeded",
        amount_minor=10000,
        currency="EGP",
        idempotency_key=f"stage7-attempt:{order.id}",
        provider_intention_id=f"stage7-intention-{order.id}",
        provider_transaction_id=f"stage7-transaction-{order.id}",
    )
    db_session.add(attempt)
    await db_session.flush()

    first = await client.post(
        f"/api/v1/admin/refunds/{order.id}",
        headers=_authorization(finance),
        json={"reason": "operations_review"},
    )
    second = await client.post(
        f"/api/v1/admin/refunds/{order.id}",
        headers=_authorization(finance),
        json={"reason": "operations_review"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["refund_id"] == second.json()["refund_id"]
    assert first.json()["created"] is True
    assert second.json()["created"] is False

    audit = await db_session.scalar(
        select(AdminAuditLog)
        .where(
            AdminAuditLog.action == "payment.refund.request",
            AdminAuditLog.entity_id == first.json()["refund_id"],
        )
        .order_by(AdminAuditLog.id.asc())
    )
    assert audit is not None
    assert audit.actor_partner_id == finance.id
    assert audit.after_summary["order_id"] == order.id

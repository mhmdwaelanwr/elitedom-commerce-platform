"""Stage 7 integration coverage for current-state RBAC and administrative audit."""

import pytest
from sqlalchemy import select

from app.models import Partner
from app.modules.admin.models import AdminAuditLog, StaffPermissionOverride
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

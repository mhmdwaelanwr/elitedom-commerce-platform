"""Stage 10 coverage for launch readiness, sign-off evidence, and RBAC/audit boundaries."""

import pytest
from sqlalchemy import select

from app.models import Partner
from app.modules.admin.models import AdminAuditLog, LaunchAcceptance
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
        phone=f"011{abs(hash(email)) % 10_000_000:07d}",
        role=role,
        company_type="person",
        is_active=True,
    )
    db_session.add(partner)
    await db_session.flush()
    return partner


async def test_launch_readiness_is_safe_blocking_and_contains_manual_gates(
    client,
    db_session,
):
    admin = await _partner(
        db_session,
        email="stage10-readiness@example.com",
        role="system_admin",
    )

    response = await client.get(
        "/api/v1/admin/launch-readiness",
        headers=_authorization(admin),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["overall_status"] == "blocked"
    assert body["blocker_count"] > 0
    assert body["gates"]
    manual = {gate["key"]: gate for gate in body["gates"] if gate["source"] == "operator"}
    assert "paymob_live_flow" in manual
    assert "backup_restore" in manual
    assert manual["backup_restore"]["status"] == "pending"
    assert manual["backup_restore"]["result"] == "block"

    serialized = response.text.lower()
    for secret_field in (
        "secret_key",
        "jwt_secret_key",
        "postgres_password",
        "redis_password",
        "paymob_hmac_secret",
        "twilio_auth_token",
        "odoo_api_key",
    ):
        assert secret_field not in serialized


async def test_launch_gate_update_requires_evidence_and_is_audited(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-operator@example.com",
        role="system_admin",
    )
    headers = _authorization(admin)

    rejected = await client.patch(
        "/api/v1/admin/launch-readiness/backup_restore",
        headers=headers,
        json={"status": "passed", "notes": "Restore completed."},
    )
    assert rejected.status_code == 409

    response = await client.patch(
        "/api/v1/admin/launch-readiness/backup_restore",
        headers=headers,
        json={
            "status": "passed",
            "evidence_ref": "runbook://stage10/postgres-restore-001",
            "notes": "Fresh database restored and application readiness rechecked.",
        },
    )

    assert response.status_code == 200
    gate = next(
        item for item in response.json()["gates"] if item["key"] == "backup_restore"
    )
    assert gate["status"] == "passed"
    assert gate["result"] == "pass"
    assert gate["verified_by"] == admin.id
    assert gate["evidence_ref"] == "runbook://stage10/postgres-restore-001"

    persisted = await db_session.get(LaunchAcceptance, "backup_restore")
    assert persisted is not None
    assert persisted.status == "passed"
    assert persisted.verified_by == admin.id

    audit = await db_session.scalar(
        select(AdminAuditLog).where(
            AdminAuditLog.action == "launch.gate.update",
            AdminAuditLog.entity_id == "backup_restore",
        )
    )
    assert audit is not None
    assert audit.actor_partner_id == admin.id
    assert audit.after_summary["status"] == "passed"


async def test_launch_gate_waiver_requires_notes(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-waiver@example.com",
        role="system_admin",
    )

    response = await client.patch(
        "/api/v1/admin/launch-readiness/monitoring_alerts",
        headers=_authorization(admin),
        json={"status": "waived"},
    )

    assert response.status_code == 409
    assert "notes" in response.json()["detail"]["message"].lower()


async def test_launch_readiness_rejects_non_staff_even_with_forged_role_claim(
    client,
    db_session,
):
    customer = await _partner(
        db_session,
        email="stage10-customer@example.com",
        role="customer",
    )

    response = await client.get(
        "/api/v1/admin/launch-readiness",
        headers=_authorization(customer, token_role="system_admin"),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "ELITE_1003"


async def test_unknown_launch_gate_is_not_mutated(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-unknown@example.com",
        role="system_admin",
    )

    response = await client.patch(
        "/api/v1/admin/launch-readiness/not-a-real-gate",
        headers=_authorization(admin),
        json={"status": "passed", "evidence_ref": "ticket://123"},
    )

    assert response.status_code == 404
    assert await db_session.get(LaunchAcceptance, "not-a-real-gate") is None

"""Stage 10 coverage for release-scoped launch readiness, evidence, RBAC, and audit."""

import pytest
from sqlalchemy import select

from app.models import Partner
from app.modules.admin.models import AdminAuditLog, LaunchAcceptance
from app.tests.auth_helpers import authorization as _authorization

pytestmark = pytest.mark.asyncio

_RELEASE_A = "stage10-release-a"
_RELEASE_B = "stage10-release-b"


def _launch_url(path: str = "", *, release_ref: str = _RELEASE_A) -> str:
    return f"/api/v1/admin/launch-readiness{path}?release_ref={release_ref}"


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
        _launch_url(),
        headers=_authorization(admin),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["release_ref"] == _RELEASE_A
    assert body["environment"] == "development"
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
        _launch_url("/backup_restore"),
        headers=headers,
        json={"status": "passed", "notes": "Restore completed."},
    )
    assert rejected.status_code == 409

    response = await client.patch(
        _launch_url("/backup_restore"),
        headers=headers,
        json={
            "status": "passed",
            "evidence_ref": "runbook://stage10/postgres-restore-001",
            "notes": "Fresh database restored and application readiness rechecked.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["release_ref"] == _RELEASE_A
    gate = next(item for item in body["gates"] if item["key"] == "backup_restore")
    assert gate["status"] == "passed"
    assert gate["result"] == "pass"
    assert gate["verified_by"] == admin.id
    assert gate["evidence_ref"] == "runbook://stage10/postgres-restore-001"

    persisted = await db_session.scalar(
        select(LaunchAcceptance).where(
            LaunchAcceptance.release_ref == _RELEASE_A,
            LaunchAcceptance.environment == "development",
            LaunchAcceptance.key == "backup_restore",
        )
    )
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
    assert audit.after_summary["release_ref"] == _RELEASE_A
    assert audit.after_summary["environment"] == "development"
    assert audit.after_summary["status"] == "passed"


async def test_launch_acceptance_does_not_carry_between_releases(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-release-scope@example.com",
        role="system_admin",
    )
    headers = _authorization(admin)

    passed = await client.patch(
        _launch_url("/uat_english", release_ref=_RELEASE_A),
        headers=headers,
        json={
            "status": "passed",
            "evidence_ref": "run://release-a/uat-english",
        },
    )
    assert passed.status_code == 200
    release_a_gate = next(
        item for item in passed.json()["gates"] if item["key"] == "uat_english"
    )
    assert release_a_gate["status"] == "passed"

    release_b = await client.get(
        _launch_url(release_ref=_RELEASE_B),
        headers=headers,
    )
    assert release_b.status_code == 200
    assert release_b.json()["release_ref"] == _RELEASE_B
    release_b_gate = next(
        item for item in release_b.json()["gates"] if item["key"] == "uat_english"
    )
    assert release_b_gate["status"] == "pending"
    assert release_b_gate["result"] == "block"


async def test_launch_gate_waiver_requires_notes(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-waiver@example.com",
        role="system_admin",
    )

    response = await client.patch(
        _launch_url("/monitoring_alerts"),
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
        _launch_url(),
        headers=_authorization(customer, token_role="system_admin"),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "ELITE_1003"


async def test_launch_readiness_requires_explicit_release_reference(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-release-required@example.com",
        role="system_admin",
    )

    missing = await client.get(
        "/api/v1/admin/launch-readiness",
        headers=_authorization(admin),
    )
    whitespace = await client.get(
        "/api/v1/admin/launch-readiness?release_ref=release%20candidate",
        headers=_authorization(admin),
    )

    assert missing.status_code == 422
    assert whitespace.status_code == 409


async def test_unknown_launch_gate_is_not_mutated(client, db_session):
    admin = await _partner(
        db_session,
        email="stage10-unknown@example.com",
        role="system_admin",
    )

    response = await client.patch(
        _launch_url("/not-a-real-gate"),
        headers=_authorization(admin),
        json={"status": "passed", "evidence_ref": "ticket://123"},
    )

    assert response.status_code == 404
    persisted = await db_session.scalar(
        select(LaunchAcceptance).where(
            LaunchAcceptance.release_ref == _RELEASE_A,
            LaunchAcceptance.environment == "development",
            LaunchAcceptance.key == "not-a-real-gate",
        )
    )
    assert persisted is None

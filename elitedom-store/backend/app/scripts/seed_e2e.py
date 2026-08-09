"""Seed deterministic, development-only identities for real browser integration tests.

The browser suite authenticates through the normal HTTP/UI flows.  This script only
creates database records that cannot be self-provisioned through public UI (B2B and
staff roles) and a normal customer account with a known CI-only password.  It never
runs outside the development environment and never bypasses authentication.
"""

from __future__ import annotations

import asyncio
import json
import os

from sqlalchemy import delete, select, update

from app.config import get_settings
from app.database import async_session_factory, engine
from app.models import Cart, Partner
from app.modules.auth.models import AdminMfaCredential, AuthSession
from app.scripts.seed_demo import seed_demo_catalog
from app.shared.security import hash_password

DEFAULT_PASSWORD = "E2eTest!2026"
FIXTURES = (
    {
        "kind": "customer",
        "email_env": "E2E_CUSTOMER_EMAIL",
        "email": "e2e-customer@example.com",
        "name": "E2E Customer",
        "phone": "01000001001",
        "role": "customer",
        "company_type": "person",
    },
    {
        "kind": "b2b",
        "email_env": "E2E_B2B_EMAIL",
        "email": "e2e-b2b@example.com",
        "name": "E2E Procurement Company",
        "phone": "01000001002",
        "role": "b2b_client",
        "company_type": "company",
    },
    {
        "kind": "admin",
        "email_env": "E2E_ADMIN_EMAIL",
        "email": "e2e-admin@example.com",
        "name": "E2E System Administrator",
        "phone": "01000001003",
        "role": "system_admin",
        "company_type": "person",
    },
)


async def _upsert_partner(session, definition: dict[str, str], password: str) -> Partner:
    email = os.getenv(definition["email_env"], definition["email"]).strip().lower()
    partner = await session.scalar(select(Partner).where(Partner.email == email))
    if partner is None:
        partner = Partner(
            name=definition["name"],
            email=email,
            phone=definition["phone"],
            role=definition["role"],
            company_type=definition["company_type"],
            password_hash=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        session.add(partner)
        await session.flush()
    else:
        partner.name = definition["name"]
        partner.phone = definition["phone"]
        partner.role = definition["role"]
        partner.company_type = definition["company_type"]
        partner.password_hash = hash_password(password)
        partner.is_active = True
        partner.email_verified = True
        await session.flush()
    return partner


async def seed_e2e() -> dict[str, object]:
    settings = get_settings()
    if settings.environment != "development":
        raise RuntimeError("E2E fixture data is restricted to ENVIRONMENT=development.")

    password = os.getenv("E2E_PASSWORD", DEFAULT_PASSWORD)
    if len(password) < 8:
        raise RuntimeError("E2E_PASSWORD must be at least 8 characters.")

    category_count, product_count = await seed_demo_catalog()

    async with async_session_factory() as session:
        partners: dict[str, Partner] = {}
        for definition in FIXTURES:
            partner = await _upsert_partner(session, definition, password)
            partners[definition["kind"]] = partner

        fixture_ids = [partner.id for partner in partners.values()]
        # Browser contexts must always start from real fresh login sessions.  This is
        # scoped only to fixture identities and does not touch any other local user.
        await session.execute(delete(AuthSession).where(AuthSession.partner_id.in_(fixture_ids)))
        await session.execute(
            update(Cart)
            .where(Cart.partner_id.in_(fixture_ids), Cart.is_active.is_(True))
            .values(is_active=False)
        )

        # Force the admin browser journey to exercise the real MFA enrollment path
        # on every fresh P22 run instead of inheriting a previous local enrollment.
        admin = partners["admin"]
        await session.execute(
            delete(AdminMfaCredential).where(AdminMfaCredential.partner_id == admin.id)
        )
        await session.commit()

        return {
            "catalog_inserted": {
                "categories": category_count,
                "products": product_count,
            },
            "accounts": {
                kind: {
                    "id": partner.id,
                    "email": partner.email,
                    "role": partner.role,
                }
                for kind, partner in partners.items()
            },
        }


async def main() -> None:
    try:
        print(json.dumps(await seed_e2e(), sort_keys=True))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

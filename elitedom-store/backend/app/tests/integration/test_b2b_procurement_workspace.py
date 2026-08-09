"""Integration coverage for the customer-facing procurement workspace."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import Partner, ProductTemplate
from app.shared.security import get_current_user


async def _b2b_partner(db: AsyncSession, email: str) -> Partner:
    partner = Partner(
        name="Northstar Design LLC" if "northstar" in email else "Other Buyer LLC",
        company_type="company",
        email=email,
        phone="01012345678",
        password_hash="not-used-by-route-tests",
        governorate="Cairo",
        street_address="90 North 90th Street, New Cairo",
        role="b2b_client",
        email_verified=True,
    )
    db.add(partner)
    await db.flush()
    return partner


async def _product(db: AsyncSession, sku: str) -> ProductTemplate:
    product = ProductTemplate(
        name=f"Procurement {sku}",
        sku=sku,
        brand="Elitedom Labs",
        base_cost_usd=Decimal("500.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("30000.00"),
        stock_qty=50,
        tracking="serial",
    )
    db.add(product)
    await db.flush()
    return product


@pytest.mark.asyncio
async def test_b2b_rfq_preserves_procurement_context_without_leaking_between_buyers(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    buyer = await _b2b_partner(db_session, "northstar@elitedom.store")
    other_buyer = await _b2b_partner(db_session, "other@elitedom.store")
    workstation = await _product(db_session, "WS-5070TI")
    monitor = await _product(db_session, "DISPLAY-4K")

    async def buyer_identity() -> dict:
        return {"user_id": buyer.id, "email": buyer.email, "role": "b2b_client"}

    app.dependency_overrides[get_current_user] = buyer_identity
    try:
        needed_by = (datetime.now(UTC) + timedelta(days=21)).date().isoformat()
        created = await client.post(
            "/api/v1/b2b/rfq",
            json={
                "items": [
                    {"product_id": workstation.id, "quantity": 24},
                    {"product_id": monitor.id, "quantity": 24},
                ],
                "notes": "Staged rollout across the design floor.",
                "procurement": {
                    "title": "Office workstation rollout",
                    "needed_by": needed_by,
                    "delivery_location": "New Cairo, Egypt",
                    "budget_target": "2500000.00",
                    "payment_terms": "Quote / bank transfer",
                },
            },
        )
        assert created.status_code == 201
        body = created.json()
        assert body["status"] == "submitted"
        assert body["procurement"]["title"] == "Office workstation rollout"
        assert body["procurement"]["company_name"] == buyer.name
        assert body["procurement"]["contact_email"] == buyer.email
        assert body["procurement"]["needed_by"] == needed_by
        assert body["procurement"]["budget_target"] == "2500000.00"
        assert body["items"][0]["product_name"] == workstation.name
        rfq_code = body["rfq_code"]

        detail = await client.get(f"/api/v1/b2b/rfq/{rfq_code}")
        assert detail.status_code == 200
        assert detail.json()["procurement"] == body["procurement"]

        listing = await client.get("/api/v1/b2b/rfq")
        assert listing.status_code == 200
        assert listing.json()["total_count"] == 1
        assert listing.json()["rfqs"][0]["procurement"]["payment_terms"] == "Quote / bank transfer"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    async def other_identity() -> dict:
        return {
            "user_id": other_buyer.id,
            "email": other_buyer.email,
            "role": "b2b_client",
        }

    app.dependency_overrides[get_current_user] = other_identity
    try:
        forbidden = await client.get(f"/api/v1/b2b/rfq/{rfq_code}")
        assert forbidden.status_code == 403
        own_list = await client.get("/api/v1/b2b/rfq")
        assert own_list.status_code == 200
        assert own_list.json()["total_count"] == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)

"""Integration coverage for customer profile, addresses, and wishlist persistence."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import Partner, ProductTemplate, WishlistItem
from app.modules.customers.schemas import (
    CustomerAddressCreateRequest,
    CustomerAddressUpdateRequest,
    UpdateCustomerProfileRequest,
    WishlistAddRequest,
)
from app.modules.customers.service import CustomerService
from app.shared.exceptions import ResourceNotFoundError
from app.shared.security import get_current_user


async def _create_customer(db: AsyncSession, email: str) -> Partner:
    customer = Partner(
        name="Customer Test",
        email=email,
        phone="01012345678",
        password_hash="not-used-by-this-test",
    )
    db.add(customer)
    await db.flush()
    return customer


async def _create_product(db: AsyncSession) -> ProductTemplate:
    product = ProductTemplate(
        name="Wishlist GPU",
        sku="WISHLIST-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
    )
    db.add(product)
    await db.flush()
    return product


@pytest.mark.asyncio
async def test_customer_portal_persists_profile_addresses_and_wishlist(
    db_session: AsyncSession,
) -> None:
    customer = await _create_customer(db_session, "owner@elitedom.store")
    other_customer = await _create_customer(db_session, "other@elitedom.store")
    product = await _create_product(db_session)
    service = CustomerService(db_session)

    profile = await service.update_profile(
        customer.id,
        UpdateCustomerProfileRequest(name="Updated Customer", governorate="Cairo"),
    )
    assert profile.name == "Updated Customer"
    assert profile.governorate == "Cairo"

    first_address = await service.add_address(
        customer.id,
        CustomerAddressCreateRequest(
            recipient_name="Updated Customer",
            recipient_phone="01012345678",
            street_address="10 Tahrir Square",
            city="Cairo",
            governorate="Cairo",
        ),
    )
    second_address = await service.add_address(
        customer.id,
        CustomerAddressCreateRequest(
            label="Office",
            recipient_name="Updated Customer",
            recipient_phone="01012345678",
            street_address="20 Smart Village",
            city="Giza",
            governorate="Giza",
            is_default=True,
        ),
    )
    assert first_address.is_default is True
    assert second_address.is_default is True

    addresses = await service.list_addresses(customer.id)
    assert [address.id for address in addresses.addresses] == [second_address.id, first_address.id]
    assert addresses.addresses[0].is_default is True
    assert addresses.addresses[1].is_default is False

    await service.set_default_address(customer.id, first_address.id)
    addresses = await service.list_addresses(customer.id)
    assert addresses.addresses[0].id == first_address.id
    assert addresses.addresses[0].is_default is True

    with pytest.raises(ResourceNotFoundError):
        await service.update_address(
            other_customer.id,
            first_address.id,
            CustomerAddressUpdateRequest(label="Attempted takeover"),
        )

    first_wishlist_item = await service.add_wishlist_item(
        customer.id, WishlistAddRequest(product_id=product.id)
    )
    second_wishlist_item = await service.add_wishlist_item(
        customer.id, WishlistAddRequest(product_id=product.id)
    )
    assert first_wishlist_item.id == second_wishlist_item.id

    wishlist_items = (
        (
            await db_session.execute(
                select(WishlistItem).where(WishlistItem.partner_id == customer.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(wishlist_items) == 1

    wishlist = await service.get_wishlist(customer.id)
    assert wishlist.items[0].product.id == product.id

    with pytest.raises(ResourceNotFoundError):
        await service.remove_wishlist_item(other_customer.id, product.id)

    await service.remove_wishlist_item(customer.id, product.id)
    assert (await service.get_wishlist(customer.id)).items == []


@pytest.mark.asyncio
async def test_customer_routes_use_jwt_subject_as_the_only_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _create_customer(db_session, "route-owner@elitedom.store")
    other_customer = await _create_customer(db_session, "route-other@elitedom.store")

    async def owner_identity() -> dict:
        return {"user_id": customer.id, "email": customer.email, "role": "customer"}

    async def other_identity() -> dict:
        return {
            "user_id": other_customer.id,
            "email": other_customer.email,
            "role": "customer",
        }

    app.dependency_overrides[get_current_user] = owner_identity
    try:
        profile_response = await client.put("/api/v1/customers/me", json={"name": "Route Owner"})
        assert profile_response.status_code == 200
        assert profile_response.json()["id"] == customer.id
        assert profile_response.json()["name"] == "Route Owner"

        address_response = await client.post(
            "/api/v1/customers/me/addresses",
            json={
                "recipient_name": "Route Owner",
                "recipient_phone": "01012345678",
                "street_address": "5 Nile Corniche",
                "city": "Cairo",
                "governorate": "Cairo",
            },
        )
        assert address_response.status_code == 201
        address_id = address_response.json()["id"]

        app.dependency_overrides[get_current_user] = other_identity
        denied_response = await client.put(
            f"/api/v1/customers/me/addresses/{address_id}",
            json={"label": "Not mine"},
        )
        assert denied_response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)

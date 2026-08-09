"""Integration coverage for guest cart ownership and checkout conversion."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Cart, Partner, ProductTemplate, SaleOrder
from app.shared.security import create_access_token


async def _create_product(db: AsyncSession) -> ProductTemplate:
    product = ProductTemplate(
        name="Guest Checkout GPU",
        sku="GUEST-CHECKOUT-GPU-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=4,
    )
    db.add(product)
    await db.flush()
    return product


@pytest.mark.asyncio
async def test_guest_cart_is_session_scoped_and_requires_an_explicit_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)

    missing_session = await client.get("/api/v1/orders/cart")
    assert missing_session.status_code == 400

    add_response = await client.post(
        "/api/v1/orders/cart/items?session_id=guest-session-a",
        json={"product_id": product.id, "quantity": 2},
    )
    assert add_response.status_code == 200
    cart = add_response.json()
    assert cart["partner_id"] is None
    assert cart["session_id"] == "guest-session-a"
    assert cart["item_count"] == 2
    assert cart["subtotal"] == "12000.00"

    item_id = cart["items"][0]["id"]
    other_session_update = await client.put(
        f"/api/v1/orders/cart/items/{item_id}?session_id=guest-session-b",
        json={"quantity": 1},
    )
    assert other_session_update.status_code == 404

    owner_update = await client.put(
        f"/api/v1/orders/cart/items/{item_id}?session_id=guest-session-a",
        json={"quantity": 1},
    )
    assert owner_update.status_code == 200
    assert owner_update.json()["items"][0]["quantity"] == 1

    owner_cart = await client.get("/api/v1/orders/cart?session_id=guest-session-a")
    assert owner_cart.status_code == 200
    assert owner_cart.json()["items"][0]["quantity"] == 1

    removed = await client.delete(f"/api/v1/orders/cart/items/{item_id}?session_id=guest-session-a")
    assert removed.status_code == 200
    assert removed.json()["item_count"] == 0
    assert removed.json()["items"] == []


@pytest.mark.asyncio
async def test_guest_checkout_creates_or_reuses_a_passwordless_partner_and_deactivates_cart(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    guest_email = "guest.buyer@elitedom.store"

    first_add = await client.post(
        "/api/v1/orders/cart/items?session_id=guest-checkout-one",
        json={"product_id": product.id, "quantity": 1},
    )
    assert first_add.status_code == 200
    first_cart_id = first_add.json()["id"]

    checkout_payload = {
        "customer_name": "Guest Buyer",
        "customer_email": guest_email,
        "customer_mobile": "+201012345678",
        "shipping_address": "15 El Matareya Street, Cairo",
        "shipping_governorate": "Cairo",
        "payment_method": "cod",
    }
    first_checkout = await client.post(
        "/api/v1/orders/checkout?session_id=guest-checkout-one",
        json=checkout_payload,
    )
    assert first_checkout.status_code == 201
    first_result = first_checkout.json()
    assert first_result["order"]["amount_subtotal"] == "6000.00"
    assert first_result["order"]["amount_shipping"] == "150.00"
    assert first_result["order"]["amount_tax"] == "861.00"
    assert first_result["order"]["amount_total"] == "7011.00"
    assert first_result["order"]["state"] == "sent"
    assert first_result["order"]["order_lines"][0]["product_id"] == product.id
    assert first_result["payment_gateway_url"] is None

    partner = await db_session.scalar(select(Partner).where(Partner.email == guest_email))
    assert partner is not None
    assert partner.password_hash is None
    assert partner.phone == "+201012345678"

    completed_cart = await db_session.get(Cart, first_cart_id)
    assert completed_cart is not None
    assert completed_cart.partner_id == partner.id
    assert completed_cart.is_active is False

    second_add = await client.post(
        "/api/v1/orders/cart/items?session_id=guest-checkout-two",
        json={"product_id": product.id, "quantity": 1},
    )
    assert second_add.status_code == 200
    second_checkout = await client.post(
        "/api/v1/orders/checkout?session_id=guest-checkout-two",
        json=checkout_payload,
    )
    assert second_checkout.status_code == 201
    assert second_checkout.json()["order"]["partner_id"] == partner.id

    partner_count = await db_session.scalar(
        select(func.count(Partner.id)).where(Partner.email == guest_email)
    )
    assert partner_count == 1
    order_count = await db_session.scalar(
        select(func.count(SaleOrder.id)).where(SaleOrder.partner_id == partner.id)
    )
    assert order_count == 2


@pytest.mark.asyncio
async def test_authenticated_cart_and_checkout_remain_partner_owned(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    customer = Partner(
        name="Authenticated Customer",
        email="authenticated.customer@elitedom.store",
        phone="01012345678",
        password_hash="unused-in-this-token-test",
    )
    db_session.add(customer)
    await db_session.flush()

    access_token = create_access_token(
        {"sub": str(customer.id), "email": customer.email, "role": "customer"}
    )
    authorization = {"Authorization": f"Bearer {access_token}"}

    add_response = await client.post(
        "/api/v1/orders/cart/items?session_id=ignored-for-authenticated-user",
        json={"product_id": product.id, "quantity": 1},
        headers=authorization,
    )
    assert add_response.status_code == 200
    assert add_response.json()["partner_id"] == customer.id
    assert add_response.json()["session_id"] is None

    checkout_response = await client.post(
        "/api/v1/orders/checkout?session_id=ignored-for-authenticated-user",
        json={
            "shipping_address": "12 Tahrir Square, Cairo",
            "shipping_governorate": "Cairo",
            "payment_method": "cod",
        },
        headers=authorization,
    )
    assert checkout_response.status_code == 201
    assert checkout_response.json()["order"]["partner_id"] == customer.id


@pytest.mark.asyncio
async def test_authenticated_cart_sync_merges_only_the_requested_guest_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    customer = Partner(
        name="Cart Sync Customer",
        email="cart.sync@elitedom.store",
        phone="01012345678",
        password_hash="unused-in-this-token-test",
    )
    db_session.add(customer)
    await db_session.flush()

    guest_cart_response = await client.post(
        "/api/v1/orders/cart/items?session_id=guest-cart-to-sync",
        json={"product_id": product.id, "quantity": 1},
    )
    assert guest_cart_response.status_code == 200
    guest_cart_id = guest_cart_response.json()["id"]

    access_token = create_access_token(
        {"sub": str(customer.id), "email": customer.email, "role": "customer"}
    )
    authorization = {"Authorization": f"Bearer {access_token}"}
    own_cart_response = await client.post(
        "/api/v1/orders/cart/items",
        json={"product_id": product.id, "quantity": 2},
        headers=authorization,
    )
    assert own_cart_response.status_code == 200

    synced = await client.post(
        "/api/v1/orders/cart/sync?session_id=guest-cart-to-sync",
        headers=authorization,
    )
    assert synced.status_code == 200
    assert synced.json()["partner_id"] == customer.id
    assert synced.json()["session_id"] is None
    assert synced.json()["items"][0]["quantity"] == 3

    guest_cart = await db_session.get(Cart, guest_cart_id)
    assert guest_cart is not None
    assert guest_cart.partner_id is None
    assert guest_cart.is_active is False


@pytest.mark.asyncio
async def test_guest_checkout_cannot_attach_an_order_to_a_registered_email(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    product = await _create_product(db_session)
    account = Partner(
        name="Protected Account",
        email="protected@elitedom.store",
        phone="01012345678",
        password_hash="a-real-account-hash",
    )
    db_session.add(account)
    await db_session.flush()

    await client.post(
        "/api/v1/orders/cart/items?session_id=guest-protected-email",
        json={"product_id": product.id, "quantity": 1},
    )
    response = await client.post(
        "/api/v1/orders/checkout?session_id=guest-protected-email",
        json={
            "customer_name": "Unverified Guest",
            "customer_email": account.email,
            "customer_mobile": "+201012345678",
            "shipping_address": "15 El Matareya Street, Cairo",
            "shipping_governorate": "Cairo",
            "payment_method": "cod",
        },
    )
    assert response.status_code == 409
    order_count = await db_session.scalar(
        select(func.count(SaleOrder.id)).where(SaleOrder.partner_id == account.id)
    )
    assert order_count == 0


@pytest.mark.asyncio
async def test_registration_cannot_claim_a_passwordless_guest_without_identity_proof(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    guest = Partner(
        name="Guest Buyer",
        email="claimable.guest@elitedom.store",
        phone="01012345678",
        password_hash=None,
        email_verified=False,
    )
    db_session.add(guest)
    await db_session.flush()

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Claimed Customer",
            "email": "CLAIMABLE.GUEST@elitedom.store",
            "mobile": "+201012345678",
            "password": "StrongPassword1!",
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "ELITE_1004"
    await db_session.refresh(guest)
    assert guest.name == "Guest Buyer"
    assert guest.phone == "01012345678"
    assert guest.password_hash is None

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "CLAIMABLE.GUEST@elitedom.store", "password": "StrongPassword1!"},
    )
    assert login_response.status_code == 401

    challenge = await client.post(
        "/api/v1/auth/otp/request",
        json={"mobile": "+201012345678", "name": "Guest Buyer"},
    )
    assert challenge.status_code == 201
    challenge_payload = challenge.json()

    verification = await client.post(
        "/api/v1/auth/otp/verify",
        json={
            "challenge_id": challenge_payload["challenge_id"],
            "mobile": "+201012345678",
            "code": challenge_payload["debug_code"],
        },
    )
    assert verification.status_code == 200
    assert verification.json()["user_id"] == guest.id

    recovery = await client.post(
        "/api/v1/auth/password/recovery",
        headers={"Authorization": f"Bearer {verification.json()['access_token']}"},
        json={"new_password": "VerifiedOwnerPassword1!"},
    )
    assert recovery.status_code == 204

    verified_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "claimable.guest@elitedom.store",
            "password": "VerifiedOwnerPassword1!",
        },
    )
    assert verified_login.status_code == 200
    assert verified_login.json()["user_id"] == guest.id

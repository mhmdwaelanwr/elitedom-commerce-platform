"""Phone-only account checkout must send the user-entered billing contact to Paymob."""

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.paymob.client import PaymobIntention
from app.models import Cart, CartItem, Partner, ProductTemplate
from app.modules.orders import service as order_service
from app.modules.orders.schemas import CheckoutRequest
from app.modules.orders.service import OrderService


@pytest.mark.asyncio
async def test_phone_account_uses_checkout_email_for_paymob(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    partner = Partner(
        name="Phone Account",
        email="phone.201012345678@phone.elitedom.local",
        phone="+201012345678",
        password_hash=None,
        email_verified=False,
    )
    product = ProductTemplate(
        name="Phone Account Laptop",
        sku="PHONE-PAYMOB-LAPTOP-001",
        base_cost_usd=Decimal("100.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("6000.00"),
        stock_qty=2,
    )
    db_session.add_all([partner, product])
    await db_session.flush()

    cart = Cart(partner_id=partner.id, is_active=True)
    db_session.add(cart)
    await db_session.flush()
    db_session.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=1))
    await db_session.flush()

    settings = SimpleNamespace(
        paymob_currency="EGP",
        paymob_card_payment_method_id=101,
        paymob_wallet_payment_method_id=202,
    )
    monkeypatch.setattr(
        order_service,
        "ensure_paymob_is_configured",
        lambda *, payment_method: settings,
    )
    captured: dict[str, Any] = {}

    async def create_intention(self: Any, **kwargs: Any) -> PaymobIntention:
        captured.update(kwargs)
        return PaymobIntention(
            id="pi-phone-account",
            client_secret="client-secret-phone-account",
            checkout_url=(
                "https://accept.paymob.com/unifiedcheckout/"
                "?publicKey=test&clientSecret=client-secret-phone-account"
            ),
            provider_order_id="provider-order-phone-account",
            special_reference=kwargs["merchant_reference"],
        )

    monkeypatch.setattr(
        order_service.PaymobClient,
        "create_intention",
        create_intention,
    )

    result = await OrderService(db_session).checkout(
        CheckoutRequest(
            customer_name="Real Customer Name",
            customer_email="real.customer@example.com",
            customer_mobile="+201012345678",
            shipping_address="15 El Matareya Street, Cairo",
            shipping_governorate="Cairo",
            payment_method="credit_card",
        ),
        partner_id=partner.id,
    )

    assert result.payment_provider == "paymob"
    assert result.paymob_intention_id == "pi-phone-account"
    assert captured["billing_data"]["email"] == "real.customer@example.com"
    assert captured["billing_data"]["phone_number"] == "+201012345678"
    assert captured["customer"]["email"] == "real.customer@example.com"
    assert "elitedom.local" not in str(captured)

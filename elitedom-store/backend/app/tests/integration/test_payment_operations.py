"""Payment status visibility and provider-neutral refund request coverage."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import OutboxEvent, Partner, SaleOrder
from app.modules.payments.models import PaymentAttempt, PaymentRefund
from app.shared.security import get_current_user


async def _paid_order(db: AsyncSession) -> tuple[Partner, SaleOrder, PaymentAttempt]:
    customer = Partner(
        name="Payment Operations Customer",
        email="payment.operations@elitedom.store",
        phone="+201012345678",
        password_hash="not-used-by-this-test",
    )
    db.add(customer)
    await db.flush()

    order = SaleOrder(
        name="SO-2026-PAYOPS",
        partner_id=customer.id,
        state="sale",
        payment_method="credit_card",
        payment_status="paid",
        amount_subtotal=Decimal("6000.00"),
        amount_shipping=Decimal("150.00"),
        amount_tax=Decimal("861.00"),
        amount_total=Decimal("7011.00"),
        currency="EGP",
        shipping_address="15 El Matareya Street, Cairo",
        shipping_governorate="Cairo",
    )
    db.add(order)
    await db.flush()

    attempt = PaymentAttempt(
        order_id=order.id,
        provider="paymob",
        payment_method="credit_card",
        status="succeeded",
        amount_minor=701100,
        currency="EGP",
        idempotency_key=f"paymob:{order.name}:credit_card",
        provider_intention_id="pi-payops",
        provider_order_id="provider-order-payops",
        provider_transaction_id="transaction-payops",
        provider_reference=order.name,
    )
    db.add(attempt)
    await db.flush()
    return customer, order, attempt


@pytest.mark.asyncio
async def test_public_payment_status_returns_no_customer_or_order_details(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, order, _ = await _paid_order(db_session)

    response = await client.get(f"/api/v1/payments/public/order/{order.name}")

    assert response.status_code == 200
    assert response.json() == {
        "order_number": order.name,
        "payment_status": "paid",
        "provider": "paymob",
        "provider_attempt_status": "succeeded",
    }
    serialized = response.text.lower()
    assert "payment.operations@elitedom.store" not in serialized
    assert "matareya" not in serialized
    assert "7011" not in serialized


@pytest.mark.asyncio
async def test_refund_request_creates_one_auditable_provider_record(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    customer, order, attempt = await _paid_order(db_session)

    async def customer_identity() -> dict:
        return {
            "user_id": customer.id,
            "email": customer.email,
            "role": "customer",
        }

    app.dependency_overrides[get_current_user] = customer_identity
    try:
        response = await client.post(
            f"/api/v1/payments/{order.id}/refund",
            params={"reason": "Customer requested cancellation"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "refund_requested"
    assert payload["provider"] == "paymob"
    assert payload["payment_status"] == "refund_requested"
    assert payload["amount_minor"] == 701100
    assert payload["currency"] == "EGP"

    refund = await db_session.get(PaymentRefund, payload["refund_id"])
    assert refund is not None
    assert refund.order_id == order.id
    assert refund.attempt_id == attempt.id
    assert refund.status == "requested"
    assert refund.idempotency_key == f"refund:paymob:{order.id}:full"

    await db_session.refresh(order)
    assert order.payment_status == "refund_requested"
    assert (
        await db_session.scalar(
            select(func.count(OutboxEvent.id)).where(
                OutboxEvent.event_type == "PaymentRefundRequested"
            )
        )
        == 1
    )


@pytest.mark.asyncio
async def test_refund_request_is_rejected_for_another_customer(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, order, _ = await _paid_order(db_session)
    other = Partner(
        name="Other Customer",
        email="other.payment@elitedom.store",
        phone="+201155555555",
        password_hash="not-used-by-this-test",
    )
    db_session.add(other)
    await db_session.flush()

    async def other_identity() -> dict:
        return {"user_id": other.id, "email": other.email, "role": "customer"}

    app.dependency_overrides[get_current_user] = other_identity
    try:
        response = await client.post(
            f"/api/v1/payments/{order.id}/refund",
            params={"reason": "Not my order"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 404
    assert await db_session.scalar(select(func.count(PaymentRefund.id))) == 0

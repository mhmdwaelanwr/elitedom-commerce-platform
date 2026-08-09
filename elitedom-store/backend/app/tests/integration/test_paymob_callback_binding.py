"""Regression tests for Paymob callback object binding."""

from copy import deepcopy
from typing import Any, Callable

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.paymob.hmac import calculate_transaction_hmac
from app.models import SaleOrder
from app.tests.integration.test_paymob_payments import (
    _add_guest_item,
    _create_product,
    _guest_checkout_payload,
    _patch_paymob_checkout,
    _transaction,
)


def _set_intention(transaction: dict[str, Any], _order: dict[str, Any]) -> None:
    transaction["payment_key_claims"]["intention_id"] = "pi_attacker_selected"


def _set_local_order_id(transaction: dict[str, Any], order: dict[str, Any]) -> None:
    transaction["payment_key_claims"]["extra"]["order_id"] = str(order["id"] + 999)


def _set_order_number(transaction: dict[str, Any], _order: dict[str, Any]) -> None:
    transaction["payment_key_claims"]["extra"]["order_number"] = "SO-ATTACKER"


def _set_merchant_reference(transaction: dict[str, Any], _order: dict[str, Any]) -> None:
    transaction["order"]["merchant_order_id"] = "SO-ATTACKER"


def _set_special_reference(transaction: dict[str, Any], _order: dict[str, Any]) -> None:
    transaction["special_reference"] = "SO-ATTACKER"


_MUTATIONS = [
    _set_intention,
    _set_local_order_id,
    _set_order_number,
    _set_merchant_reference,
    _set_special_reference,
]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mutate",
    _MUTATIONS,
    ids=[
        "intention-id",
        "local-order-id",
        "order-number",
        "merchant-reference",
        "special-reference",
    ],
)
async def test_hmac_valid_callback_rejects_conflicting_unsigned_reference(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    mutate: Callable[[dict[str, Any], dict[str, Any]], None],
) -> None:
    product = await _create_product(db_session)
    session_id = f"paymob-binding-{mutate.__name__}"
    await _add_guest_item(client, product.id, session_id)
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        f"/api/v1/orders/checkout?session_id={session_id}",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    order = checkout.json()["order"]

    transaction_id = 7800 + _MUTATIONS.index(mutate)
    clean_transaction = _transaction(
        order=order,
        transaction_id=transaction_id,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
    )
    signature = calculate_transaction_hmac(
        clean_transaction,
        settings.paymob_hmac_secret,
    )
    tampered_transaction = deepcopy(clean_transaction)
    mutate(tampered_transaction, order)

    # These routing claims are deliberately outside Paymob's transaction HMAC.
    # The signature therefore remains valid and object binding must reject the
    # conflict independently of signature verification.
    assert (
        calculate_transaction_hmac(tampered_transaction, settings.paymob_hmac_secret)
        == signature
    )

    response = await client.post(
        f"/api/v1/webhooks/paymob/transaction?hmac={signature}",
        json={"type": "TRANSACTION", "obj": tampered_transaction},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "rejected"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "pending"
    assert persisted_order.state == "draft"


@pytest.mark.asyncio
async def test_rejected_unsigned_tamper_does_not_poison_legitimate_callback(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = await _create_product(db_session)
    await _add_guest_item(client, product.id, "paymob-binding-poison")
    settings = _patch_paymob_checkout(monkeypatch)
    checkout = await client.post(
        "/api/v1/orders/checkout?session_id=paymob-binding-poison",
        json=_guest_checkout_payload(),
    )
    assert checkout.status_code == 201
    order = checkout.json()["order"]

    clean_transaction = _transaction(
        order=order,
        transaction_id=7899,
        intention_id="pi_paymob_test",
        provider_order_id="9988",
    )
    signature = calculate_transaction_hmac(
        clean_transaction,
        settings.paymob_hmac_secret,
    )
    tampered_transaction = deepcopy(clean_transaction)
    _set_intention(tampered_transaction, order)
    assert (
        calculate_transaction_hmac(tampered_transaction, settings.paymob_hmac_secret)
        == signature
    )

    rejected = await client.post(
        f"/api/v1/webhooks/paymob/transaction?hmac={signature}",
        json={"type": "TRANSACTION", "obj": tampered_transaction},
    )
    legitimate = await client.post(
        f"/api/v1/webhooks/paymob/transaction?hmac={signature}",
        json={"type": "TRANSACTION", "obj": clean_transaction},
    )

    assert rejected.json() == {"status": "rejected"}
    assert legitimate.json() == {"status": "processed"}
    persisted_order = await db_session.get(SaleOrder, order["id"])
    assert persisted_order is not None
    await db_session.refresh(persisted_order)
    assert persisted_order.payment_status == "paid"
    assert persisted_order.state == "sale"

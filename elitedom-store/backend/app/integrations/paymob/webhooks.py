"""Verified, idempotent Paymob transaction callback processing."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings, is_secure_secret
from app.database import get_db
from app.integrations.paymob.hmac import verify_transaction_hmac
from app.models import SaleOrder
from app.modules.payments.models import PaymentAttempt, PaymentWebhookEvent
from app.modules.payments.transitions import (
    mark_payment_failed,
    mark_payment_refunded,
    mark_payment_succeeded,
)
from app.shared.exceptions import (
    WebhookSignatureInvalidError,
    WebhookSignatureMissingError,
)
from app.shared.schemas import PaymentMethod

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _identifier(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, str | int) and str(value).strip():
        return str(value)
    return None


def _boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().casefold() == "true"
    return bool(value)


def _integer(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdecimal():
        return int(value)
    return None


def _event_key(transaction: Mapping[str, Any]) -> str:
    """Keep retries idempotent without letting unsigned claims poison a valid event."""
    order_payload = _mapping(transaction.get("order"))
    claims = _mapping(transaction.get("payment_key_claims"))
    intention_payload = _mapping(transaction.get("intention"))
    claim_extras = _mapping(claims.get("extra"))
    transaction_extras = _mapping(transaction.get("extras"))
    state = {
        "id": transaction.get("id"),
        "pending": _boolean(transaction.get("pending")),
        "success": _boolean(transaction.get("success")),
        "refunded": _boolean(transaction.get("is_refunded")),
        "voided": _boolean(transaction.get("is_voided")),
        "amount": transaction.get("amount_cents"),
        "currency": transaction.get("currency"),
        # Binding-relevant claims are included even when Paymob does not cover
        # them with the transaction HMAC. A tampered rejected callback therefore
        # cannot consume the idempotency key of the legitimate callback that
        # carries the same signed transaction fields.
        "provider_order_id": _identifier(order_payload.get("id")),
        "intention_id": (
            _identifier(intention_payload.get("id"))
            or _identifier(claims.get("intention_id"))
            or _identifier(transaction.get("intention_id"))
        ),
        "claim_order_id": _integer(claim_extras.get("order_id")),
        "claim_order_number": _identifier(claim_extras.get("order_number")),
        "transaction_order_id": _integer(transaction_extras.get("order_id")),
        "transaction_order_number": _identifier(transaction_extras.get("order_number")),
        "merchant_order_id": _identifier(order_payload.get("merchant_order_id")),
        "order_special_reference": _identifier(order_payload.get("special_reference")),
        "transaction_special_reference": _identifier(transaction.get("special_reference")),
    }
    digest = hashlib.sha256(
        json.dumps(state, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    transaction_id = _identifier(transaction.get("id")) or "unknown"
    return f"transaction:{transaction_id}:{digest}"


def _callback_type(transaction: Mapping[str, Any]) -> str:
    if _boolean(transaction.get("is_refunded")):
        return "transaction.refunded"
    if _boolean(transaction.get("is_voided")):
        return "transaction.voided"
    if _boolean(transaction.get("pending")):
        return "transaction.pending"
    if _boolean(transaction.get("success")) and not _boolean(
        transaction.get("error_occured")
    ):
        return "transaction.succeeded"
    return "transaction.failed"


def _provider_order_id(transaction: Mapping[str, Any]) -> str | None:
    return _identifier(_mapping(transaction.get("order")).get("id"))


def _binding_error(
    transaction: Mapping[str, Any],
    attempt: PaymentAttempt,
    order: SaleOrder,
) -> str | None:
    """Require every callback reference to agree with the signed provider object.

    Only HMAC-covered provider identifiers are allowed to select an attempt.
    Unsigned intention/extras/merchant references are treated as redundant
    claims and may only confirm the already-selected local object.
    """
    provider_order_id = _provider_order_id(transaction)
    if provider_order_id is None:
        return "missing_provider_order_id"
    if not attempt.provider_order_id or provider_order_id != attempt.provider_order_id:
        return "provider_order_mismatch"

    transaction_id = _identifier(transaction.get("id"))
    if attempt.provider_transaction_id and transaction_id != attempt.provider_transaction_id:
        return "transaction_id_mismatch"

    order_payload = _mapping(transaction.get("order"))
    claims = _mapping(transaction.get("payment_key_claims"))
    intention_payload = _mapping(transaction.get("intention"))
    claim_extras = _mapping(claims.get("extra"))
    transaction_extras = _mapping(transaction.get("extras"))

    intention_values = (
        _identifier(intention_payload.get("id")),
        _identifier(claims.get("intention_id")),
        _identifier(transaction.get("intention_id")),
    )
    for intention_id in intention_values:
        if intention_id is not None and intention_id != attempt.provider_intention_id:
            return "intention_mismatch"

    for extras in (claim_extras, transaction_extras):
        local_order_id = _integer(extras.get("order_id"))
        if local_order_id is not None and local_order_id != order.id:
            return "local_order_id_mismatch"
        order_number = _identifier(extras.get("order_number"))
        if order_number is not None and order_number != order.name:
            return "order_number_mismatch"

    merchant_order_id = _identifier(order_payload.get("merchant_order_id"))
    if merchant_order_id is not None and merchant_order_id != order.name:
        return "merchant_order_id_mismatch"

    expected_reference = attempt.provider_reference or order.name
    for special_reference in (
        _identifier(order_payload.get("special_reference")),
        _identifier(transaction.get("special_reference")),
    ):
        if special_reference is not None and special_reference != expected_reference:
            return "special_reference_mismatch"

    return None


def _expected_integration_id(attempt: PaymentAttempt) -> int:
    if attempt.payment_method == PaymentMethod.CREDIT_CARD.value:
        return settings.paymob_card_payment_method_id
    if attempt.payment_method == PaymentMethod.MOBILE_WALLET.value:
        return settings.paymob_wallet_payment_method_id
    return 0


def _validation_error(
    transaction: Mapping[str, Any],
    attempt: PaymentAttempt,
    order: SaleOrder,
) -> str | None:
    binding_error = _binding_error(transaction, attempt, order)
    if binding_error:
        return binding_error

    amount = _integer(transaction.get("amount_cents"))
    if amount is None:
        return "missing_payment_amount"
    if amount != attempt.amount_minor:
        return "amount_mismatch"

    currency = transaction.get("currency")
    if not isinstance(currency, str):
        return "missing_payment_currency"
    if currency.strip().upper() != attempt.currency.strip().upper():
        return "currency_mismatch"
    if attempt.currency.strip().upper() != order.currency.strip().upper():
        return "order_currency_mismatch"

    integration_id = _integer(transaction.get("integration_id"))
    if integration_id != _expected_integration_id(attempt):
        return "integration_mismatch"
    return None


@router.post("/transaction")
async def paymob_transaction_webhook(
    request: Request,
    hmac_value: str | None = Query(default=None, alias="hmac"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Verify a Paymob HMAC and apply one transaction state exactly once."""
    if not hmac_value:
        raise WebhookSignatureMissingError()
    if not is_secure_secret(settings.paymob_hmac_secret, minimum_length=32):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Paymob webhook processing is not configured.",
        )

    try:
        payload = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise WebhookSignatureInvalidError() from error
    envelope = _mapping(payload)
    transaction = _mapping(envelope.get("obj"))
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Paymob callback payload.",
        )
    if not verify_transaction_hmac(
        transaction,
        hmac_value,
        settings.paymob_hmac_secret,
    ):
        logger.warning("Rejected Paymob callback with an invalid HMAC")
        raise WebhookSignatureInvalidError()

    result = await process_paymob_transaction(db=db, transaction=transaction)
    return {"status": result}


async def process_paymob_transaction(
    *,
    db: AsyncSession,
    transaction: Mapping[str, Any],
) -> str:
    """Process one already-verified Paymob transaction callback."""
    transaction_id = _identifier(transaction.get("id"))
    if not transaction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paymob callback is missing the transaction id.",
        )

    callback_type = _callback_type(transaction)
    receipt = await _register_event(
        db=db,
        event_key=_event_key(transaction),
        event_type=callback_type,
        provider_transaction_id=transaction_id,
    )
    if receipt is None:
        return "duplicate"

    attempt, order = await _find_attempt_and_order(db, transaction)
    if attempt is None or order is None:
        receipt.processing_status = "unmatched"
        receipt.processed_at = datetime.now(UTC)
        await db.flush()
        return "unmatched"

    receipt.attempt_id = attempt.id
    receipt.order_id = order.id
    validation_error = _validation_error(transaction, attempt, order)
    if validation_error:
        receipt.processing_status = f"rejected_{validation_error}"
        receipt.processed_at = datetime.now(UTC)
        await db.flush()
        logger.warning(
            "Rejected Paymob transaction %s for order %s: %s",
            transaction_id,
            order.name,
            validation_error,
        )
        return "rejected"

    if callback_type == "transaction.pending":
        attempt.status = "pending"
        attempt.provider_transaction_id = transaction_id
        outcome = "pending"
    elif callback_type == "transaction.succeeded":
        outcome = await mark_payment_succeeded(
            db=db,
            order=order,
            attempt=attempt,
            provider_transaction_id=transaction_id,
        )
    elif callback_type == "transaction.refunded":
        outcome = await mark_payment_refunded(
            db=db,
            order=order,
            attempt=attempt,
            provider_transaction_id=transaction_id,
            provider_refund_id=_identifier(transaction.get("refunded_transaction_id")),
        )
    else:
        data = _mapping(transaction.get("data"))
        failure_code = (
            _identifier(data.get("message"))
            or _identifier(data.get("txn_response_code"))
            or callback_type.removeprefix("transaction.")
        )
        outcome = await mark_payment_failed(
            db=db,
            order=order,
            attempt=attempt,
            provider_transaction_id=transaction_id,
            failure_code=failure_code,
        )

    receipt.processing_status = outcome
    receipt.processed_at = datetime.now(UTC)
    await db.flush()
    return outcome


async def _register_event(
    *,
    db: AsyncSession,
    event_key: str,
    event_type: str,
    provider_transaction_id: str,
) -> PaymentWebhookEvent | None:
    receipt = PaymentWebhookEvent(
        provider="paymob",
        event_key=event_key,
        event_type=event_type,
        provider_transaction_id=provider_transaction_id,
    )
    try:
        async with db.begin_nested():
            db.add(receipt)
            await db.flush()
    except IntegrityError:
        return None
    return receipt


async def _find_attempt_and_order(
    db: AsyncSession,
    transaction: Mapping[str, Any],
) -> tuple[PaymentAttempt | None, SaleOrder | None]:
    # Resolve only from HMAC-covered Paymob identifiers. Do not allow unsigned
    # intention/extras/merchant references to choose a local payment object.
    provider_order_id = _provider_order_id(transaction)
    transaction_id = _identifier(transaction.get("id"))

    attempt: PaymentAttempt | None = None
    if provider_order_id is not None:
        attempt = await db.scalar(
            select(PaymentAttempt)
            .where(
                PaymentAttempt.provider == "paymob",
                PaymentAttempt.provider_order_id == provider_order_id,
            )
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )
    if attempt is None and transaction_id is not None:
        attempt = await db.scalar(
            select(PaymentAttempt)
            .where(
                PaymentAttempt.provider == "paymob",
                PaymentAttempt.provider_transaction_id == transaction_id,
            )
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )
    if attempt is None:
        return None, None

    order = await db.scalar(
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .where(SaleOrder.id == attempt.order_id)
        .with_for_update()
    )
    if order is None:
        return attempt, None
    return attempt, order


def order_amount_minor(order: SaleOrder) -> int:
    """Exact helper used by checkout and reconciliation tests."""
    try:
        amount = Decimal(order.amount_total)
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError("Order total is not a valid decimal amount.") from error
    minor = amount * Decimal("100")
    if amount < 0 or minor != minor.to_integral_value():
        raise ValueError("Order total cannot be represented in minor units.")
    return int(minor)

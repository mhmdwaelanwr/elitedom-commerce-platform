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
    if isinstance(value, (str, int)) and str(value).strip():
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
    """Keep terminal state changes distinct while making retries idempotent."""
    state = {
        "id": transaction.get("id"),
        "pending": _boolean(transaction.get("pending")),
        "success": _boolean(transaction.get("success")),
        "refunded": _boolean(transaction.get("is_refunded")),
        "voided": _boolean(transaction.get("is_voided")),
        "amount": transaction.get("amount_cents"),
        "currency": transaction.get("currency"),
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


def _order_reference(transaction: Mapping[str, Any]) -> tuple[int | None, str | None]:
    order_payload = _mapping(transaction.get("order"))
    claims = _mapping(transaction.get("payment_key_claims"))
    extras = _mapping(claims.get("extra")) or _mapping(transaction.get("extras"))

    local_id = _integer(extras.get("order_id"))
    reference = (
        _identifier(extras.get("order_number"))
        or _identifier(order_payload.get("merchant_order_id"))
        or _identifier(order_payload.get("special_reference"))
        or _identifier(transaction.get("special_reference"))
    )
    return local_id, reference


def _provider_references(
    transaction: Mapping[str, Any],
) -> tuple[str | None, str | None]:
    order_payload = _mapping(transaction.get("order"))
    claims = _mapping(transaction.get("payment_key_claims"))
    intention_payload = _mapping(transaction.get("intention"))
    provider_order_id = _identifier(order_payload.get("id"))
    intention_id = (
        _identifier(intention_payload.get("id"))
        or _identifier(claims.get("intention_id"))
        or _identifier(transaction.get("intention_id"))
    )
    return intention_id, provider_order_id


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
    local_order_id, order_reference = _order_reference(transaction)
    intention_id, provider_order_id = _provider_references(transaction)
    transaction_id = _identifier(transaction.get("id"))

    attempt: PaymentAttempt | None = None
    predicates = []
    if transaction_id:
        predicates.append(PaymentAttempt.provider_transaction_id == transaction_id)
    if intention_id:
        predicates.append(PaymentAttempt.provider_intention_id == intention_id)
    if provider_order_id:
        predicates.append(PaymentAttempt.provider_order_id == provider_order_id)
    if order_reference:
        predicates.append(PaymentAttempt.provider_reference == order_reference)

    for predicate in predicates:
        attempt = await db.scalar(
            select(PaymentAttempt)
            .where(PaymentAttempt.provider == "paymob", predicate)
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )
        if attempt is not None:
            break

    order_predicate = None
    if attempt is not None:
        order_predicate = SaleOrder.id == attempt.order_id
    elif local_order_id is not None:
        order_predicate = SaleOrder.id == local_order_id
    elif order_reference:
        order_predicate = SaleOrder.name == order_reference

    if order_predicate is None:
        return attempt, None

    order = await db.scalar(
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .where(order_predicate)
        .with_for_update()
    )
    if order is None:
        return attempt, None

    if attempt is None:
        attempt = await db.scalar(
            select(PaymentAttempt)
            .where(
                PaymentAttempt.provider == "paymob",
                PaymentAttempt.order_id == order.id,
            )
            .order_by(PaymentAttempt.created_at.desc())
            .limit(1)
        )
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

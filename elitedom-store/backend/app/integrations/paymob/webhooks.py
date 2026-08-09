"""Paymob webhook processing with HMAC verification and idempotency guards."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.integrations.paymob.service import get_paymob_service
from app.modules.orders.models import Order
from app.modules.orders.payment_models import PaymentAttempt, PaymentWebhookReceipt

settings = get_settings()

_HMAC_FIELDS = (
    "amount_cents",
    "created_at",
    "currency",
    "error_occured",
    "has_parent_transaction",
    "id",
    "integration_id",
    "is_3d_secure",
    "is_auth",
    "is_capture",
    "is_refunded",
    "is_standalone_payment",
    "is_voided",
    "order",
    "owner",
    "pending",
    "source_data.pan",
    "source_data.sub_type",
    "source_data.type",
    "success",
)


def _value_at_path(data: dict[str, Any], path: str) -> Any:
    value: Any = data
    for part in path.split("."):
        if not isinstance(value, dict):
            return ""
        value = value.get(part, "")
    return value


def _stringify_hmac_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def _hmac_message(obj: dict[str, Any]) -> str:
    pieces: list[str] = []
    for field in _HMAC_FIELDS:
        value = _value_at_path(obj, field)
        if field == "order" and isinstance(value, dict):
            value = value.get("id", "")
        pieces.append(_stringify_hmac_value(value))
    return "".join(pieces)


def verify_paymob_hmac(obj: dict[str, Any], received_hmac: str) -> bool:
    """Validate Paymob's transaction callback signature."""
    secret = settings.paymob_hmac_secret.get_secret_value()
    if not secret or not received_hmac:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        _hmac_message(obj).encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, received_hmac)


def _transaction_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    obj = payload.get("obj")
    if isinstance(obj, dict):
        return obj
    return payload


def _as_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _transaction_order_id(transaction: dict[str, Any]) -> str | None:
    provider_order = transaction.get("order")
    if isinstance(provider_order, dict):
        provider_order = provider_order.get("id")
    if provider_order in (None, ""):
        return None
    return str(provider_order)


def _transaction_extra(transaction: dict[str, Any]) -> tuple[int | None, str | None, str | None]:
    claims = transaction.get("payment_key_claims")
    if not isinstance(claims, dict):
        return None, None, None
    extra = claims.get("extra")
    if not isinstance(extra, dict):
        extra = {}
    local_order_id = _as_int(extra.get("order_id"))
    order_number = extra.get("order_number")
    intention_id = claims.get("intention_id")
    return (
        local_order_id,
        str(order_number) if order_number not in (None, "") else None,
        str(intention_id) if intention_id not in (None, "") else None,
    )


def _raw_local_order_id(transaction: dict[str, Any]) -> tuple[bool, Any]:
    """Return whether a local order ID claim was supplied and its raw value.

    A present-but-malformed redundant binding is not equivalent to an omitted
    binding. Treating it as missing would let a signed provider identifier
    bypass a contradictory unsigned/local claim instead of rejecting the
    callback conservatively.
    """
    claims = transaction.get("payment_key_claims")
    if not isinstance(claims, dict):
        return False, None
    extra = claims.get("extra")
    if not isinstance(extra, dict) or "order_id" not in extra:
        return False, None
    return True, extra.get("order_id")


def _provider_transaction_id(transaction: dict[str, Any]) -> str | None:
    value = transaction.get("id")
    if value in (None, ""):
        return None
    return str(value)


async def _attempt_from_extra(db: AsyncSession, transaction: dict[str, Any]) -> PaymentAttempt | None:
    local_order_id, order_number, intention_id = _transaction_extra(transaction)
    attempt: PaymentAttempt | None = None
    if intention_id:
        attempt = await db.scalar(
            select(PaymentAttempt).where(PaymentAttempt.provider_intention_id == intention_id)
        )
        if attempt is not None:
            return attempt
    if local_order_id is not None:
        attempt = await db.scalar(
            select(PaymentAttempt)
            .where(PaymentAttempt.order_id == local_order_id)
            .order_by(PaymentAttempt.created_at.desc())
        )
        if attempt is not None:
            return attempt
    if order_number:
        order = await db.scalar(select(Order).where(Order.name == order_number))
        if order is not None:
            return await db.scalar(
                select(PaymentAttempt)
                .where(PaymentAttempt.order_id == order.id)
                .order_by(PaymentAttempt.created_at.desc())
            )
    return None


async def _find_attempt_and_order(
    db: AsyncSession,
    transaction: dict[str, Any],
) -> tuple[PaymentAttempt | None, Order | None]:
    provider_transaction_id = _provider_transaction_id(transaction)
    provider_order_id = _transaction_order_id(transaction)

    by_transaction: PaymentAttempt | None = None
    by_provider_order: PaymentAttempt | None = None
    if provider_transaction_id:
        by_transaction = await db.scalar(
            select(PaymentAttempt).where(
                PaymentAttempt.provider_transaction_id == provider_transaction_id
            )
        )
    if provider_order_id:
        by_provider_order = await db.scalar(
            select(PaymentAttempt)
            .where(PaymentAttempt.provider_order_id == provider_order_id)
            .order_by(PaymentAttempt.created_at.desc())
        )

    if (
        by_transaction is not None
        and by_provider_order is not None
        and by_transaction.id != by_provider_order.id
    ):
        # Both identifiers are HMAC-covered by Paymob. A callback that binds
        # each signed identifier to a different local attempt is ambiguous and
        # must not choose either attempt.
        return None, None

    attempt = by_transaction or by_provider_order
    if attempt is None:
        attempt = await _attempt_from_extra(db, transaction)
    if attempt is None:
        return None, None
    order = await db.scalar(select(Order).where(Order.id == attempt.order_id))
    return attempt, order


def _binding_error(
    transaction: dict[str, Any],
    attempt: PaymentAttempt,
    order: Order,
) -> str | None:
    provider_order_id = _transaction_order_id(transaction)
    provider_transaction_id = _provider_transaction_id(transaction)
    local_order_id, order_number, intention_id = _transaction_extra(transaction)
    local_order_id_present, raw_local_order_id = _raw_local_order_id(transaction)

    if provider_order_id and attempt.provider_order_id:
        if str(attempt.provider_order_id) != provider_order_id:
            return "provider_order_mismatch"
    if provider_transaction_id and attempt.provider_transaction_id:
        if str(attempt.provider_transaction_id) != provider_transaction_id:
            return "provider_transaction_mismatch"
    if intention_id and attempt.provider_intention_id:
        if str(attempt.provider_intention_id) != intention_id:
            return "intention_mismatch"
    if local_order_id_present:
        parsed_local_order_id = _as_int(raw_local_order_id)
        if parsed_local_order_id is None or parsed_local_order_id != order.id:
            return "local_order_mismatch"
    elif local_order_id is not None and local_order_id != order.id:
        return "local_order_mismatch"
    if order_number and order.name and order_number != order.name:
        return "order_number_mismatch"
    if attempt.provider_reference and order.name and attempt.provider_reference != order.name:
        return "attempt_reference_mismatch"
    return None


def _rejected_event_key(
    transaction: dict[str, Any],
    *,
    reason: str,
    attempt: PaymentAttempt | None,
) -> str:
    """Create an idempotency key for a rejected callback without consuming the accepted event key."""
    material = json.dumps(
        transaction,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
    attempt_id = str(attempt.id) if attempt is not None else "unknown"
    return f"paymob:rejected:{reason}:{attempt_id}:{digest}"


async def _register_receipt(
    db: AsyncSession,
    *,
    event_key: str,
    transaction: dict[str, Any],
    signature_valid: bool,
    attempt_id: int | None,
    processed: bool,
    error_message: str | None = None,
) -> tuple[PaymentWebhookReceipt, bool]:
    receipt = await db.scalar(
        select(PaymentWebhookReceipt).where(PaymentWebhookReceipt.event_key == event_key)
    )
    if receipt is not None:
        return receipt, False
    receipt = PaymentWebhookReceipt(
        provider="paymob",
        event_key=event_key,
        event_type="transaction",
        payload=transaction,
        signature_valid=signature_valid,
        payment_attempt_id=attempt_id,
        processed=processed,
        error_message=error_message,
    )
    db.add(receipt)
    await db.flush()
    return receipt, True


async def _record_rejected_callback(
    db: AsyncSession,
    *,
    transaction: dict[str, Any],
    reason: str,
    attempt: PaymentAttempt | None,
) -> dict[str, str]:
    await _register_receipt(
        db,
        event_key=_rejected_event_key(transaction, reason=reason, attempt=attempt),
        transaction=transaction,
        signature_valid=True,
        attempt_id=attempt.id if attempt is not None else None,
        processed=False,
        error_message=reason,
    )
    await db.commit()
    return {"status": "rejected"}


def _locked_attempt_statement(attempt_id: int):
    statement = select(PaymentAttempt).where(PaymentAttempt.id == attempt_id)
    bind = getattr(PaymentAttempt.__table__.metadata, "bind", None)
    dialect_name = getattr(getattr(bind, "dialect", None), "name", None)
    if dialect_name == "sqlite":
        return statement
    return statement.with_for_update()


async def _mark_failed(
    db: AsyncSession,
    attempt: PaymentAttempt,
    transaction: dict[str, Any],
) -> None:
    attempt.status = "failed"
    attempt.provider_transaction_id = (
        _provider_transaction_id(transaction) or attempt.provider_transaction_id
    )
    attempt.provider_order_id = _transaction_order_id(transaction) or attempt.provider_order_id
    attempt.raw_response = transaction
    await db.flush()


async def process_paymob_transaction(
    db: AsyncSession,
    *,
    payload: dict[str, Any],
    received_hmac: str,
) -> dict[str, str]:
    """Verify and process a Paymob transaction callback."""
    transaction = _transaction_from_payload(payload)
    if not verify_paymob_hmac(transaction, received_hmac):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Paymob callback signature",
        )

    provider_transaction_id = _provider_transaction_id(transaction)
    if provider_transaction_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paymob callback did not include a transaction ID",
        )

    attempt, order = await _find_attempt_and_order(db, transaction)
    if attempt is None:
        return await _record_rejected_callback(
            db,
            transaction=transaction,
            reason="payment_attempt_not_found_or_conflicting_signed_identifiers",
            attempt=None,
        )
    if order is None:
        return await _record_rejected_callback(
            db,
            transaction=transaction,
            reason="order_not_found",
            attempt=attempt,
        )

    binding_error = _binding_error(transaction, attempt, order)
    if binding_error is not None:
        return await _record_rejected_callback(
            db,
            transaction=transaction,
            reason=binding_error,
            attempt=attempt,
        )

    # Register the accepted event only after all callback-to-order bindings are
    # validated. A signed-but-contradictory callback must never consume the
    # idempotency key that a later valid callback needs.
    receipt, created = await _register_receipt(
        db,
        event_key=f"paymob:transaction:{provider_transaction_id}",
        transaction=transaction,
        signature_valid=True,
        attempt_id=attempt.id,
        processed=False,
    )
    if not created and receipt.processed:
        return {"status": "duplicate"}

    service = get_paymob_service()
    locked_attempt = await db.scalar(_locked_attempt_statement(attempt.id))
    if locked_attempt is None:
        receipt.error_message = "payment_attempt_disappeared"
        await db.commit()
        return {"status": "rejected"}
    locked_order = await db.scalar(select(Order).where(Order.id == locked_attempt.order_id))
    if locked_order is None:
        receipt.error_message = "order_not_found"
        await db.commit()
        return {"status": "rejected"}

    if bool(transaction.get("success")) and not bool(transaction.get("pending")):
        service.capture_attempt(
            locked_attempt,
            provider_order_id=_transaction_order_id(transaction),
            provider_transaction_id=provider_transaction_id,
            raw_response=transaction,
        )
        if locked_order.status != "Paid":
            locked_order.status = "Paid"
            locked_order.payment_status = "paid"
    elif not bool(transaction.get("pending")):
        await _mark_failed(db, locked_attempt, transaction)
        if locked_order.status != "Paid":
            locked_order.status = "Payment Failed"
            locked_order.payment_status = "failed"

    receipt.payment_attempt_id = locked_attempt.id
    receipt.processed = True
    receipt.error_message = None
    await db.commit()
    return {"status": "processed"}

"""Verified, idempotent Stripe payment webhook processing.

Only Stripe's signed event id and the minimal identifiers required for an
audit trail are stored.  Raw webhook payloads are deliberately not persisted.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models import ProductTemplate, SaleOrder, StripeWebhookEvent
from app.modules.suppliers.dropship import DropshipFulfillmentService
from app.shared.events import PaymentFailed, PaymentSucceeded
from app.shared.exceptions import (
    ExternalServiceError,
    WebhookSignatureInvalidError,
    WebhookSignatureMissingError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, PaymentMethod, PaymentStatus

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

_SUCCESS_EVENT_TYPES = {"checkout.session.completed", "payment_intent.succeeded"}
_FAILURE_EVENT_TYPES = {"payment_intent.payment_failed"}
_STRIPE_MINOR_UNIT = Decimal("100")


@dataclass(frozen=True)
class WebhookProcessingResult:
    """Publicly safe result of a Stripe event processing attempt."""

    status: str
    order_id: int | None = None


def _value(resource: Any, key: str) -> Any:
    if isinstance(resource, Mapping):
        return resource.get(key)
    getter = getattr(resource, "get", None)
    if callable(getter):
        value = getter(key)
        if value is not None:
            return value
    return getattr(resource, key, None)


def _identifier(resource: Any) -> str | None:
    if isinstance(resource, str) and resource:
        return resource
    value = _value(resource, "id")
    return value if isinstance(value, str) and value else None


def _metadata(resource: Any) -> Mapping[str, Any]:
    metadata = _value(resource, "metadata")
    return metadata if isinstance(metadata, Mapping) else {}


def _valid_webhook_secret(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip()) and "CHANGE_ME" not in value.upper()


def _event_identifiers(event_type: str, event_data: Any) -> tuple[str | None, str | None]:
    """Return (Checkout Session id, PaymentIntent id) from a Stripe object."""
    object_id = _identifier(event_data)
    if event_type.startswith("checkout.session."):
        return object_id, _identifier(_value(event_data, "payment_intent"))

    if event_type.startswith("payment_intent."):
        return _identifier(_value(event_data, "checkout_session")), object_id

    return None, None


def _stripe_minor_amount(value: Any) -> int | None:
    """Return a non-negative Stripe minor-unit amount without coercing floats."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    # Stripe serializes amounts as integers.  Accepting an integral string
    # keeps dict-based webhook adapters compatible without accepting a lossy
    # float or decimal representation.
    if isinstance(value, str) and value.isdecimal():
        return int(value)
    return None


def _order_minor_amount(order: SaleOrder) -> int | None:
    """Convert a two-decimal order total into Stripe's exact minor units."""
    try:
        amount = Decimal(order.amount_total)
    except (InvalidOperation, TypeError, ValueError):
        return None
    minor_amount = amount * _STRIPE_MINOR_UNIT
    integral_minor_amount = minor_amount.to_integral_value()
    if amount < 0 or minor_amount != integral_minor_amount:
        return None
    return int(integral_minor_amount)


def _success_event_validation_error(
    *, event_type: str, event_data: Any, order: SaleOrder
) -> str | None:
    """Validate the signed provider amount/currency before accepting payment.

    A Stripe signature proves that Stripe sent the event, not that it belongs
    to this exact priced order.  Both success event shapes expose a minor-unit
    amount and currency, so treat either missing or non-identical values as a
    reconciliation exception instead of confirming the order.
    """
    if event_type == "checkout.session.completed":
        payment_status = _value(event_data, "payment_status")
        if not isinstance(payment_status, str) or payment_status.casefold() != "paid":
            return "payment_not_paid"
        paid_amount = _stripe_minor_amount(_value(event_data, "amount_total"))
    elif event_type == "payment_intent.succeeded":
        paid_amount = _stripe_minor_amount(_value(event_data, "amount_received"))
    else:
        return "unsupported_success_event"

    expected_amount = _order_minor_amount(order)
    if paid_amount is None:
        return "missing_payment_amount"
    if expected_amount is None:
        return "invalid_order_amount"
    if paid_amount != expected_amount:
        return "amount_mismatch"

    currency = _value(event_data, "currency")
    expected_currency = order.currency
    if not isinstance(currency, str) or not isinstance(expected_currency, str):
        return "missing_payment_currency"
    if currency.strip().casefold() != expected_currency.strip().casefold():
        return "currency_mismatch"
    return None


@router.post("/stripe-callback")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Verify a Stripe signature, then mutate the local payment state once."""
    if not stripe_signature:
        raise WebhookSignatureMissingError()
    if not _valid_webhook_secret(settings.stripe_webhook_secret):
        # Do not accept unsigned-or-unverifiable events during an incomplete
        # deployment.  Returning 503 lets Stripe retry after configuration is
        # corrected without pretending that the event was processed.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook processing is not configured.",
        )

    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=body,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError as error:
        logger.warning("Rejected Stripe webhook with an invalid signature")
        raise WebhookSignatureInvalidError() from error
    except (TypeError, ValueError, KeyError) as error:
        logger.warning("Rejected malformed Stripe webhook payload")
        raise WebhookSignatureInvalidError() from error

    event_id = _identifier(event)
    event_type = _value(event, "type")
    event_data = _value(_value(event, "data"), "object")
    if not event_id or not isinstance(event_type, str) or event_data is None:
        logger.warning("Rejected Stripe event missing its id, type, or data object")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe event.")

    result = await process_stripe_event(
        db=db,
        event_id=event_id,
        event_type=event_type,
        event_data=event_data,
    )
    logger.info(
        "Processed Stripe webhook event=%s type=%s status=%s order_id=%s",
        event_id,
        event_type,
        result.status,
        result.order_id,
    )
    return {"status": result.status}


async def process_stripe_event(
    *,
    db: AsyncSession,
    event_id: str,
    event_type: str,
    event_data: Any,
) -> WebhookProcessingResult:
    """Apply one verified Stripe event with database-backed idempotency."""
    record = await _register_event(
        db=db,
        event_id=event_id,
        event_type=event_type,
        stripe_object_id=_identifier(event_data),
    )
    if record is None:
        return WebhookProcessingResult(status="duplicate")

    if event_type not in _SUCCESS_EVENT_TYPES | _FAILURE_EVENT_TYPES:
        record.processing_status = "ignored"
        await db.flush()
        return WebhookProcessingResult(status="ignored")

    order = await _find_order_for_event(db, event_type, event_data)
    if order is None:
        record.processing_status = "unmatched"
        await db.flush()
        logger.warning("No local order matched verified Stripe event %s", event_id)
        return WebhookProcessingResult(status="unmatched")

    record.order_id = order.id
    session_id, payment_intent_id = _event_identifiers(event_type, event_data)

    if order.payment_method != PaymentMethod.CREDIT_CARD.value:
        record.processing_status = "ignored"
        await db.flush()
        logger.warning("Ignored Stripe event %s for non-card order %s", event_id, order.name)
        return WebhookProcessingResult(status="ignored", order_id=order.id)

    if event_type in _SUCCESS_EVENT_TYPES:
        validation_error = _success_event_validation_error(
            event_type=event_type,
            event_data=event_data,
            order=order,
        )
        if validation_error:
            # Keep the signed event for finance reconciliation, but do not
            # attach its provider identifiers or mutate an order to paid.
            record.processing_status = f"rejected_{validation_error}"
            await db.flush()
            logger.warning(
                "Rejected Stripe success event %s for order %s: %s",
                event_id,
                order.name,
                validation_error,
            )
            return WebhookProcessingResult(status="rejected", order_id=order.id)
        outcome = await _mark_payment_succeeded(
            db=db,
            order=order,
            session_id=session_id,
            payment_intent_id=payment_intent_id,
        )
    else:
        outcome = await _mark_payment_failed(
            db=db,
            order=order,
            session_id=session_id,
            payment_intent_id=payment_intent_id,
        )

    record.processing_status = outcome
    await db.flush()
    return WebhookProcessingResult(status=outcome, order_id=order.id)


async def _register_event(
    *,
    db: AsyncSession,
    event_id: str,
    event_type: str,
    stripe_object_id: str | None,
) -> StripeWebhookEvent | None:
    """Insert a unique event id inside a savepoint; duplicates are harmless."""
    record = StripeWebhookEvent(
        stripe_event_id=event_id,
        event_type=event_type,
        stripe_object_id=stripe_object_id,
    )
    try:
        async with db.begin_nested():
            db.add(record)
            await db.flush()
    except IntegrityError:
        return None
    return record


async def _locked_order(db: AsyncSession, predicate: Any) -> SaleOrder | None:
    result = await db.execute(
        select(SaleOrder)
        .options(selectinload(SaleOrder.order_lines))
        .where(predicate)
        .with_for_update()
    )
    return result.scalar_one_or_none()


async def _find_order_for_event(
    db: AsyncSession, event_type: str, event_data: Any
) -> SaleOrder | None:
    """Resolve an order from redundant, Stripe-written metadata or stored ids."""
    metadata = _metadata(event_data)
    order_id_value = metadata.get("order_id")
    order_number = metadata.get("order_number")

    if order_id_value is not None:
        try:
            order_id = int(order_id_value)
        except (TypeError, ValueError):
            return None
        order = await _locked_order(db, SaleOrder.id == order_id)
        if order is None:
            return None
        if isinstance(order_number, str) and order.name != order_number:
            # A verified Stripe event still must not join two conflicting local
            # references; retain it as unmatched for manual reconciliation.
            return None
        return order

    if isinstance(order_number, str) and order_number:
        return await _locked_order(db, SaleOrder.name == order_number)

    session_id, payment_intent_id = _event_identifiers(event_type, event_data)
    if session_id:
        order = await _locked_order(db, SaleOrder.stripe_session_id == session_id)
        if order is not None:
            return order
    if payment_intent_id:
        return await _locked_order(db, SaleOrder.stripe_payment_intent_id == payment_intent_id)
    return None


def _apply_stripe_identifiers(
    order: SaleOrder, session_id: str | None, payment_intent_id: str | None
) -> None:
    if session_id:
        order.stripe_session_id = session_id
    if payment_intent_id:
        order.stripe_payment_intent_id = payment_intent_id


async def _mark_payment_succeeded(
    *,
    db: AsyncSession,
    order: SaleOrder,
    session_id: str | None,
    payment_intent_id: str | None,
) -> str:
    _apply_stripe_identifiers(order, session_id, payment_intent_id)

    if order.payment_status == PaymentStatus.REFUNDED.value:
        return "ignored"
    if order.payment_status == PaymentStatus.PAID.value:
        return "already_processed"

    # Stripe can emit a late success after a declined attempt.  If the failure
    # had released inventory, reserve it again before accepting the paid state.
    # A shortage raises a 5xx so Stripe retries rather than silently overselling.
    if order.stock_reservation_released:
        await _reserve_order_stock(db, order)
        order.stock_reservation_released = False

    order.payment_status = PaymentStatus.PAID.value
    if order.state in {
        OrderState.DRAFT.value,
        OrderState.SENT.value,
        OrderState.CANCEL.value,
    }:
        order.state = OrderState.SALE.value
    await db.flush()

    # A dropship PO is created only inside the confirmed-payment transition.
    # The service uses verified primary supplier mappings and a durable key, so
    # webhook replays cannot create a second PO or send customer data outward.
    await DropshipFulfillmentService(db).ensure_purchase_orders_for_paid_order(order.id)

    await publish_domain_event(
        db,
        PaymentSucceeded(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "stripe_session_id": order.stripe_session_id,
                "stripe_payment_intent_id": order.stripe_payment_intent_id,
            }
        ),
        source_context="stripe_webhook",
    )
    return "processed"


async def _mark_payment_failed(
    *,
    db: AsyncSession,
    order: SaleOrder,
    session_id: str | None,
    payment_intent_id: str | None,
) -> str:
    _apply_stripe_identifiers(order, session_id, payment_intent_id)

    # Never downgrade a paid/refunded order because an old failure webhook was
    # delivered out of order.  The identifiers are still retained for audit.
    if order.payment_status in {PaymentStatus.PAID.value, PaymentStatus.REFUNDED.value}:
        return "ignored"
    if order.payment_status == PaymentStatus.FAILED.value or order.stock_reservation_released:
        return "already_processed"

    order.payment_status = PaymentStatus.FAILED.value
    order.state = OrderState.CANCEL.value
    order.stock_reservation_released = True
    await db.flush()
    await _release_order_stock(db, order)
    await db.flush()

    await publish_domain_event(
        db,
        PaymentFailed(
            payload={
                "order_id": order.id,
                "order_number": order.name,
                "stripe_session_id": order.stripe_session_id,
                "stripe_payment_intent_id": order.stripe_payment_intent_id,
            }
        ),
        source_context="stripe_webhook",
    )
    return "processed"


async def _reserve_order_stock(db: AsyncSession, order: SaleOrder) -> None:
    """Re-reserve released local stock before accepting a late payment success."""
    quantities = await _non_dropship_quantities(db, order)
    for product_id, quantity in quantities.items():
        reservation = await db.execute(
            update(ProductTemplate)
            .where(ProductTemplate.id == product_id, ProductTemplate.stock_qty >= quantity)
            .values(stock_qty=ProductTemplate.stock_qty - quantity)
        )
        if reservation.rowcount != 1:
            logger.error("Cannot re-reserve stock for paid Stripe order %s", order.name)
            raise ExternalServiceError(
                "Inventory", "Unable to reserve stock for a successful Stripe payment."
            )


async def _release_order_stock(db: AsyncSession, order: SaleOrder) -> None:
    """Return only locally-reserved inventory; dropship lines were never reserved."""
    quantities = await _non_dropship_quantities(db, order)
    for product_id, quantity in quantities.items():
        release = await db.execute(
            update(ProductTemplate)
            .where(ProductTemplate.id == product_id)
            .values(stock_qty=ProductTemplate.stock_qty + quantity)
        )
        if release.rowcount != 1:
            logger.error("Cannot restore stock for failed Stripe order %s", order.name)
            raise ExternalServiceError(
                "Inventory", "Unable to restore stock for a failed Stripe payment."
            )


async def _non_dropship_quantities(db: AsyncSession, order: SaleOrder) -> dict[int, int]:
    """Aggregate only products that were reserved from local inventory."""
    product_ids = {line.product_id for line in order.order_lines}
    if not product_ids:
        return {}

    products = await db.execute(
        select(ProductTemplate.id, ProductTemplate.is_dropship_enabled).where(
            ProductTemplate.id.in_(product_ids)
        )
    )
    dropship_by_id = {product_id: is_dropship for product_id, is_dropship in products.all()}
    if product_ids - dropship_by_id.keys():
        logger.error("Order %s refers to a missing inventory product", order.name)
        raise ExternalServiceError("Inventory", "A product for this order no longer exists.")

    quantities: dict[int, int] = {}
    for line in order.order_lines:
        if not dropship_by_id[line.product_id]:
            quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity
    return quantities

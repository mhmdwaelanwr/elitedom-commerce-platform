"""Stripe Checkout Session creation for credit-card orders.

This boundary intentionally accepts only already-priced order data.  It never
accepts a client-provided amount or card data, and it returns a hosted Stripe
URL only when Stripe returned one itself.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import stripe

from app.config import get_settings
from app.models import CartItem, ProductTemplate, SaleOrder
from app.shared.exceptions import (
    ExternalServiceError,
    PaymentDeclinedError,
    PaymentGatewayUnavailableError,
)

logger = logging.getLogger(__name__)
_MINOR_UNIT = Decimal("100")


@dataclass(frozen=True)
class StripeCheckoutSession:
    """The safe subset of a newly-created Stripe Checkout Session."""

    id: str
    url: str
    payment_intent_id: str | None = None


def _is_real_setting(value: object) -> bool:
    """Reject empty values and the example placeholders shipped with the app."""
    if not isinstance(value, str) or not value.strip():
        return False
    return "CHANGE_ME" not in value.upper()


def _is_http_url(value: object) -> bool:
    if not _is_real_setting(value):
        return False
    parsed = urlsplit(str(value))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def stripe_checkout_is_configured(settings: Any | None = None) -> bool:
    """Whether all values required for a safe hosted-credit-card flow exist."""
    active_settings = settings or get_settings()
    currency = str(getattr(active_settings, "stripe_currency", "")).strip()
    return (
        _is_real_setting(getattr(active_settings, "stripe_secret_key", ""))
        and _is_real_setting(getattr(active_settings, "stripe_webhook_secret", ""))
        and _is_http_url(getattr(active_settings, "stripe_checkout_success_url", ""))
        and _is_http_url(getattr(active_settings, "stripe_checkout_cancel_url", ""))
        and len(currency) == 3
        and currency.isalpha()
    )


def ensure_stripe_checkout_is_configured(settings: Any | None = None) -> Any:
    """Return settings or stop before checkout changes any persistent state."""
    active_settings = settings or get_settings()
    if not stripe_checkout_is_configured(active_settings):
        raise PaymentGatewayUnavailableError(
            "Credit-card checkout is unavailable until Stripe and its return URLs are configured."
        )
    return active_settings


def stripe_idempotency_key(order: SaleOrder) -> str:
    """Stable key for retries of the same durable order creation attempt."""
    return f"ord-{order.name.lower()}-stripe"


def _with_checkout_session_placeholder(url: str) -> str:
    """Ensure Stripe can return its session id without guessing a frontend URL."""
    if "{CHECKOUT_SESSION_ID}" in url:
        return url

    parsed = urlsplit(url)
    separator = "&" if parsed.query else ""
    query = f"{parsed.query}{separator}session_id={{CHECKOUT_SESSION_ID}}"
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def _minor_units(amount: Decimal) -> int:
    """Convert EGP/USD Decimal amounts to Stripe's two-decimal minor units."""
    return int((amount * _MINOR_UNIT).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _resource_value(resource: Any, key: str) -> Any:
    if isinstance(resource, Mapping):
        return resource.get(key)
    getter = getattr(resource, "get", None)
    if callable(getter):
        value = getter(key)
        if value is not None:
            return value
    return getattr(resource, key, None)


def _resource_id(resource: Any) -> str | None:
    if isinstance(resource, str) and resource:
        return resource
    value = _resource_value(resource, "id")
    return value if isinstance(value, str) and value else None


def _line_items(
    order: SaleOrder,
    cart_items: Sequence[CartItem],
    products_by_id: Mapping[int, ProductTemplate],
    currency: str,
) -> list[dict[str, Any]]:
    line_items: list[dict[str, Any]] = []
    for item in cart_items:
        product = products_by_id[item.product_id]
        line_items.append(
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {
                        "name": product.name,
                        "metadata": {
                            "product_id": str(product.id),
                            "sku": product.sku,
                        },
                    },
                    "unit_amount": _minor_units(product.list_price),
                },
                "quantity": item.quantity,
            }
        )

    delivery_and_tax = order.amount_shipping + order.amount_tax
    if delivery_and_tax:
        line_items.append(
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {"name": "Delivery and VAT"},
                    "unit_amount": _minor_units(delivery_and_tax),
                },
                "quantity": 1,
            }
        )
    return line_items


async def create_checkout_session(
    *,
    order: SaleOrder,
    cart_items: Sequence[CartItem],
    products_by_id: Mapping[int, ProductTemplate],
    settings: Any | None = None,
) -> StripeCheckoutSession:
    """Create one real hosted Stripe Checkout Session for an order.

    ``order`` has already been flushed in the enclosing database transaction,
    so the idempotency key is derived from its immutable order reference.  A
    Stripe failure is raised to the caller; the request-scoped database
    transaction then rolls back the order, stock reservation, and cart change.
    """
    active_settings = ensure_stripe_checkout_is_configured(settings)
    currency = str(active_settings.stripe_currency).lower()
    metadata = {
        "order_id": str(order.id),
        "order_number": order.name,
        "partner_id": str(order.partner_id),
    }
    if order.shipping_governorate:
        metadata["shipping_governorate"] = order.shipping_governorate

    params: dict[str, Any] = {
        "mode": "payment",
        "payment_method_types": ["card"],
        "line_items": _line_items(order, cart_items, products_by_id, currency),
        "success_url": _with_checkout_session_placeholder(
            str(active_settings.stripe_checkout_success_url)
        ),
        "cancel_url": str(active_settings.stripe_checkout_cancel_url),
        "client_reference_id": order.name,
        "metadata": metadata,
        # PaymentIntent metadata allows payment_intent.* events to be resolved
        # even when Stripe sends them before a checkout.session.* event.
        "payment_intent_data": {"metadata": metadata},
    }

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            **params,
            api_key=active_settings.stripe_secret_key,
            idempotency_key=stripe_idempotency_key(order),
        )
    except stripe.error.CardError as error:
        logger.info("Stripe declined Checkout Session creation for order %s", order.name)
        raise PaymentDeclinedError() from error
    except stripe.error.StripeError as error:
        logger.warning(
            "Stripe Checkout Session creation failed for order %s: %s",
            order.name,
            error,
        )
        raise ExternalServiceError("Stripe", "Unable to initialize secure checkout.") from error

    session_id = _resource_id(session)
    checkout_url = _resource_value(session, "url")
    if (
        not session_id
        or not isinstance(checkout_url, str)
        or not checkout_url.startswith("https://")
    ):
        logger.error("Stripe returned an incomplete Checkout Session for order %s", order.name)
        raise ExternalServiceError(
            "Stripe", "Stripe did not return a usable hosted checkout session."
        )

    return StripeCheckoutSession(
        id=session_id,
        url=checkout_url,
        payment_intent_id=_resource_id(_resource_value(session, "payment_intent")),
    )

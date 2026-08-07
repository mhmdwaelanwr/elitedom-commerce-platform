"""Paymob Intention API and Unified Checkout boundary.

This client accepts only server-priced amounts. It never handles card details and
returns a Paymob-hosted checkout URL built from the provider client secret.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx

from app.config import get_settings, is_https_url, is_secure_secret
from app.shared.exceptions import ExternalServiceError, PaymentGatewayUnavailableError
from app.shared.schemas import PaymentMethod

logger = logging.getLogger(__name__)
_MINOR_UNIT = Decimal("100")


@dataclass(frozen=True)
class PaymobIntention:
    """Safe subset of an initialized Paymob payment intention."""

    id: str
    client_secret: str
    checkout_url: str
    provider_order_id: str | None = None
    special_reference: str | None = None


def _payment_method_id(settings: Any, payment_method: PaymentMethod) -> int:
    if payment_method == PaymentMethod.CREDIT_CARD:
        return int(getattr(settings, "paymob_card_payment_method_id", 0) or 0)
    if payment_method == PaymentMethod.MOBILE_WALLET:
        return int(getattr(settings, "paymob_wallet_payment_method_id", 0) or 0)
    return 0


def paymob_is_configured(
    settings: Any | None = None,
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD,
) -> bool:
    """Whether Paymob can safely initialize the requested hosted payment."""
    active = settings or get_settings()
    currency = str(getattr(active, "paymob_currency", "")).strip()
    return (
        bool(getattr(active, "paymob_enabled", False))
        and is_secure_secret(getattr(active, "paymob_secret_key", ""), minimum_length=20)
        and is_secure_secret(getattr(active, "paymob_public_key", ""), minimum_length=20)
        and is_secure_secret(getattr(active, "paymob_hmac_secret", ""), minimum_length=32)
        and _payment_method_id(active, payment_method) > 0
        and is_https_url(str(getattr(active, "paymob_base_url", "")))
        and is_https_url(str(getattr(active, "paymob_unified_checkout_url", "")))
        and len(currency) == 3
        and currency.isalpha()
    )


def ensure_paymob_is_configured(
    settings: Any | None = None,
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD,
) -> Any:
    """Return settings or stop before checkout creates durable state."""
    active = settings or get_settings()
    if not paymob_is_configured(active, payment_method):
        raise PaymentGatewayUnavailableError(
            "Paymob checkout is unavailable until its keys, HMAC secret, and payment method ID are configured."
        )
    return active


def to_minor_units(amount: Decimal) -> int:
    """Convert an exact two-decimal amount to Paymob minor units."""
    if amount < 0:
        raise ValueError("Payment amount cannot be negative.")
    return int((amount * _MINOR_UNIT).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def unified_checkout_url(base_url: str, public_key: str, client_secret: str) -> str:
    """Build the Paymob-hosted checkout URL without exposing the API secret."""
    if not is_https_url(base_url):
        raise ValueError("Paymob Unified Checkout URL must use HTTPS.")
    parsed = urlsplit(base_url)
    query = urlencode({"publicKey": public_key, "clientSecret": client_secret})
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def _string_identifier(value: Any) -> str | None:
    if isinstance(value, str | int) and str(value).strip():
        return str(value)
    return None


class PaymobClient:
    """Small async client for creating Paymob payment intentions."""

    def __init__(
        self,
        settings: Any | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.http_client = http_client

    async def create_intention(
        self,
        *,
        amount: Decimal,
        currency: str,
        payment_method: PaymentMethod,
        merchant_reference: str,
        order_id: int,
        items: Sequence[Mapping[str, Any]],
        billing_data: Mapping[str, Any],
        customer: Mapping[str, Any],
    ) -> PaymobIntention:
        """Create one Paymob intention for an already-priced local order."""
        settings = ensure_paymob_is_configured(self.settings, payment_method)
        normalized_currency = currency.strip().upper()
        configured_currency = str(settings.paymob_currency).strip().upper()
        if normalized_currency != configured_currency:
            raise ValueError("Order currency does not match the configured Paymob currency.")

        payload: dict[str, Any] = {
            "amount": to_minor_units(amount),
            "currency": normalized_currency,
            "payment_methods": [_payment_method_id(settings, payment_method)],
            "items": [dict(item) for item in items],
            "billing_data": dict(billing_data),
            "customer": dict(customer),
            "special_reference": merchant_reference,
            "extras": {
                "order_id": str(order_id),
                "order_number": merchant_reference,
            },
        }
        notification_url = str(getattr(settings, "paymob_notification_url", "")).strip()
        redirection_url = str(getattr(settings, "paymob_redirection_url", "")).strip()
        if notification_url:
            payload["notification_url"] = notification_url
        if redirection_url:
            payload["redirection_url"] = redirection_url

        headers = {
            "Authorization": f"Token {settings.paymob_secret_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        endpoint = str(settings.paymob_base_url).rstrip("/") + "/v1/intention/"

        try:
            if self.http_client is not None:
                response = await self.http_client.post(endpoint, json=payload, headers=headers)
            else:
                timeout = float(getattr(settings, "paymob_timeout_seconds", 15.0))
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        except (httpx.TimeoutException, httpx.NetworkError) as error:
            logger.warning("Paymob intention request was unavailable for order %s", merchant_reference)
            raise ExternalServiceError(
                "Paymob", "Unable to reach the secure payment service."
            ) from error
        except (httpx.HTTPStatusError, ValueError, TypeError) as error:
            logger.warning("Paymob rejected or returned an invalid intention for order %s", merchant_reference)
            raise ExternalServiceError(
                "Paymob", "Unable to initialize secure checkout."
            ) from error

        if not isinstance(data, Mapping):
            raise ExternalServiceError("Paymob", "Paymob returned an invalid intention response.")

        intention_id = _string_identifier(data.get("id"))
        client_secret = data.get("client_secret")
        if not intention_id or not isinstance(client_secret, str) or not client_secret.strip():
            raise ExternalServiceError("Paymob", "Paymob returned an incomplete intention response.")

        return PaymobIntention(
            id=intention_id,
            client_secret=client_secret,
            checkout_url=unified_checkout_url(
                str(settings.paymob_unified_checkout_url),
                str(settings.paymob_public_key),
                client_secret,
            ),
            provider_order_id=_string_identifier(data.get("intention_order_id")),
            special_reference=_string_identifier(data.get("special_reference")),
        )

"""
Elitedom Store — Webhook Signature Verification Middleware
Validates HMAC-SHA256 signatures on incoming webhooks.
Per API_SECURITY.md: X-Elitedom-Signature header.
"""

import hashlib
import hmac
import logging

from fastapi import Header, Request

from app.config import get_settings, is_secure_secret
from app.shared.exceptions import (
    WebhookNotConfiguredError,
    WebhookSignatureInvalidError,
    WebhookSignatureMissingError,
)

logger = logging.getLogger(__name__)
settings = get_settings()


async def verify_odoo_webhook(
    request: Request,
    x_elitedom_signature: str = Header(..., alias="X-Elitedom-Signature"),
) -> bytes:
    """
    FastAPI dependency to verify Odoo webhook HMAC-SHA256 signatures.
    Returns the raw request body on success.

    Per ODOO.md Section 2.2:
    - All outgoing webhooks from Odoo include X-Elitedom-Signature header.
    - Algorithm: HMAC-SHA256 hash of the request body using shared secret.
    """
    body = await request.body()

    if not x_elitedom_signature:
        logger.warning("Odoo webhook received without signature header")
        raise WebhookSignatureMissingError()

    secret = settings.odoo_webhook_secret
    if not is_secure_secret(secret):
        # Never derive an HMAC from an empty/template secret: doing so makes a
        # publicly knowable key an authorization mechanism for stock/orders.
        logger.error("Odoo webhook rejected because its signing secret is not configured")
        raise WebhookNotConfiguredError("Odoo")

    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, x_elitedom_signature):
        logger.warning("Odoo webhook signature verification failed")
        raise WebhookSignatureInvalidError()

    logger.info("Odoo webhook signature verified successfully")
    return body


async def verify_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(..., alias="Stripe-Signature"),
) -> bytes:
    """
    FastAPI dependency to verify Stripe webhook signatures.
    Returns the raw request body on success.

    Per STRIPE.md Section 4:
    - All incoming webhooks verified using Stripe webhook signing secret.
    """
    body = await request.body()

    if not stripe_signature:
        logger.warning("Stripe webhook received without Stripe-Signature header")
        raise WebhookSignatureMissingError()

    # Stripe signature verification is handled by the stripe library
    # This dependency just extracts the body and signature
    # Actual verification happens in the webhook handler using stripe.Webhook.construct_event()
    return body

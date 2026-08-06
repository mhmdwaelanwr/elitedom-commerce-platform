"""
Elitedom Store — Hedera blockchain audit integration.

The repository does not currently ship a Hedera SDK client. The task therefore
fails closed when explicitly enabled and never fabricates transaction IDs.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class HederaIntegrationUnavailable(RuntimeError):
    """Raised when Hedera is enabled without a real HCS submission client."""


def compute_payment_hash(payment_data: dict) -> str:
    """Compute a deterministic SHA-256 hash of payment transaction data."""
    payload = json.dumps(payment_data, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@celery_app.task(name="app.integrations.hedera.tasks.hash_payment_to_hedera")
def hash_payment_to_hedera(
    order_number: str,
    amount: float,
    currency: str,
    payment_method: str,
    customer_id: int,
) -> dict[str, str]:
    """Hash payment data and submit it only when a real Hedera client exists."""
    payment_data = {
        "order_number": order_number,
        "amount": amount,
        "currency": currency,
        "payment_method": payment_method,
        "customer_id": customer_id,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    payload_hash = compute_payment_hash(payment_data)
    logger.info("Payment hash computed for order %s", order_number)

    if not settings.hedera_enabled:
        logger.warning(
            "Hedera audit skipped because HEDERA_ENABLED=false: order=%s",
            order_number,
        )
        return {
            "status": "skipped",
            "provider": "hedera",
            "reason": "disabled",
            "payload_hash": payload_hash,
        }

    raise HederaIntegrationUnavailable(
        "Hedera was enabled, but real HCS submission is not implemented. "
        "No transaction ID has been created."
    )

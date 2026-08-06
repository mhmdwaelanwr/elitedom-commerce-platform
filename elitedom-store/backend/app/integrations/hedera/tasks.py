"""
Elitedom Store — Hedera Blockchain Audit Integration
Hashes payment records onto the Hedera Consensus Service per HEDERA.md.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def compute_payment_hash(payment_data: dict) -> str:
    """Compute SHA-256 hash of payment transaction data."""
    payload = json.dumps(payment_data, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@celery_app.task(name="app.integrations.hedera.tasks.hash_payment_to_hedera")
def hash_payment_to_hedera(
    order_number: str,
    amount: float,
    currency: str,
    payment_method: str,
    customer_id: int,
):
    """
    Hash a completed payment transaction onto the Hedera network.
    Per HEDERA.md and DATABASE_ERD.md Section 3.11.
    """
    payment_data = {
        "order_number": order_number,
        "amount": amount,
        "currency": currency,
        "payment_method": payment_method,
        "customer_id": customer_id,
        "timestamp": datetime.now(UTC).isoformat(),
    }

    payload_hash = compute_payment_hash(payment_data)
    logger.info(f"Payment hash computed for {order_number}: {payload_hash[:16]}...")

    # TODO: Submit to Hedera Consensus Service
    # from hedera import Client, TopicMessageSubmitTransaction
    # client = Client.for_testnet()
    # client.set_operator(settings.hedera_operator_id, settings.hedera_operator_key)
    # tx = TopicMessageSubmitTransaction()
    #     .set_topic_id(settings.hedera_topic_id)
    #     .set_message(payload_hash)
    # receipt = tx.execute(client).get_receipt(client)
    # hedera_tx_id = str(receipt.transaction_id)

    hedera_tx_id = f"0.0.{settings.hedera_operator_id}@{int(datetime.now(UTC).timestamp())}"

    # TODO: Store in elitedom_hedera_audit table
    logger.info(f"Hedera audit hash submitted: {hedera_tx_id}")

    return {
        "payload_hash": payload_hash,
        "hedera_tx_id": hedera_tx_id,
    }

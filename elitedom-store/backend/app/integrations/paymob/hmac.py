"""Paymob transaction callback HMAC verification.

The transaction callback uses a fixed provider-defined field order and SHA-512.
Only verified callback objects may reach payment state transitions.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Mapping
from typing import Any

TRANSACTION_HMAC_FIELDS: tuple[str, ...] = (
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
    "order.id",
    "owner",
    "pending",
    "source_data.pan",
    "source_data.sub_type",
    "source_data.type",
    "success",
)


def _nested_value(payload: Mapping[str, Any], dotted_path: str) -> Any:
    value: Any = payload
    for part in dotted_path.split("."):
        if not isinstance(value, Mapping):
            return None
        value = value.get(part)
    return value


def _canonical_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def transaction_hmac_message(payload: Mapping[str, Any]) -> str:
    """Build the exact provider callback string in Paymob's documented order."""
    return "".join(
        _canonical_value(_nested_value(payload, field))
        for field in TRANSACTION_HMAC_FIELDS
    )


def calculate_transaction_hmac(payload: Mapping[str, Any], secret: str) -> str:
    """Return the lowercase SHA-512 HMAC for a transaction callback object."""
    return hmac.new(
        secret.encode(),
        transaction_hmac_message(payload).encode(),
        hashlib.sha512,
    ).hexdigest()


def verify_transaction_hmac(
    payload: Mapping[str, Any],
    received_hmac: str,
    secret: str,
) -> bool:
    """Compare callback HMAC values without leaking timing information."""
    if not received_hmac or not secret:
        return False
    expected = calculate_transaction_hmac(payload, secret)
    return hmac.compare_digest(expected, received_hmac.strip().lower())

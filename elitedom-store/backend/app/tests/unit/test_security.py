"""
Unit tests for security utilities (password hashing, JWT, HMAC verification).
"""

from datetime import timedelta

import pytest

from app.shared.exceptions import TokenExpiredError
from app.shared.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_hmac_signature,
    verify_password,
)


def test_password_hashing():
    plain = "SuperSecretPassword123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_access_token_lifecycle():
    payload = {"sub": "123", "email": "test@elitedom.store", "role": "customer"}
    token = create_access_token(payload)
    decoded = decode_token(token)
    assert decoded["sub"] == "123"
    assert decoded["email"] == "test@elitedom.store"
    assert decoded["type"] == "access"


def test_jwt_expired_token():
    payload = {"sub": "123", "email": "test@elitedom.store", "role": "customer"}
    # Token expired 1 minute ago
    token = create_access_token(payload, expires_delta=timedelta(minutes=-1))
    with pytest.raises(TokenExpiredError):
        decode_token(token)


def test_hmac_signature_verification():
    secret = "test_webhook_secret_key"
    payload = b'{"event": "inventory.update", "sku": "ED-001"}'

    import hashlib
    import hmac

    valid_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    assert verify_hmac_signature(payload, valid_sig, secret) is True
    assert verify_hmac_signature(payload, "invalid_signature_hex", secret) is False

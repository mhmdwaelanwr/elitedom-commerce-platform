"""Staff multi-factor authentication primitives.

TOTP seeds are encrypted at rest with a key derived from the application
secret. Recovery codes are stored only as keyed hashes and are single-use.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.shared.exceptions import InvalidCredentialsError

settings = get_settings()
_TOTP_PERIOD = 30
_TOTP_DIGITS = 6
_TOTP_WINDOW = 1


def _fernet() -> Fernet:
    digest = hashlib.sha256(
        settings.secret_key.encode("utf-8") + b":elitedom:staff-mfa:v1"
    ).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def encrypt_totp_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_totp_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError):
        raise InvalidCredentialsError() from None


def provisioning_uri(*, email: str, secret: str) -> str:
    issuer = settings.app_name
    label = quote(f"{issuer}:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer, safe='')}"
        f"&algorithm=SHA1&digits={_TOTP_DIGITS}&period={_TOTP_PERIOD}"
    )


def _totp_at(secret: str, counter: int) -> str:
    padded = secret + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % (10**_TOTP_DIGITS):0{_TOTP_DIGITS}d}"


def verify_totp(secret: str, code: str, *, now: int | None = None) -> bool:
    if len(code) != _TOTP_DIGITS or not code.isdigit():
        return False
    current = (int(time.time()) if now is None else now) // _TOTP_PERIOD
    return any(
        hmac.compare_digest(_totp_at(secret, current + offset), code)
        for offset in range(-_TOTP_WINDOW, _TOTP_WINDOW + 1)
    )


def generate_recovery_codes(count: int = 8) -> list[str]:
    return [f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    normalized = code.strip().lower().encode("utf-8")
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        b"staff-mfa-recovery:" + normalized,
        hashlib.sha256,
    ).hexdigest()


def encode_recovery_hashes(codes: list[str]) -> str:
    return json.dumps([hash_recovery_code(code) for code in codes], separators=(",", ":"))


def consume_recovery_code(encoded_hashes: str, code: str) -> tuple[bool, str]:
    try:
        hashes = list(json.loads(encoded_hashes or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        hashes = []
    candidate = hash_recovery_code(code)
    for index, stored in enumerate(hashes):
        if isinstance(stored, str) and hmac.compare_digest(stored, candidate):
            del hashes[index]
            return True, json.dumps(hashes, separators=(",", ":"))
    return False, encoded_hashes

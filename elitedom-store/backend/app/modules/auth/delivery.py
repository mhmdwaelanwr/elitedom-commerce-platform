"""Phone OTP delivery using the existing Twilio configuration."""

import asyncio
import logging

from twilio.rest import Client

from app.config import get_settings, is_secure_secret
from app.modules.auth.errors import OtpDeliveryUnavailableError

logger = logging.getLogger(__name__)
settings = get_settings()


def _twilio_is_configured() -> bool:
    sender_configured = bool(
        settings.twilio_messaging_service_sid.strip()
        or settings.twilio_phone_number.strip()
    )
    return (
        settings.twilio_account_sid.strip().startswith("AC")
        and is_secure_secret(settings.twilio_auth_token, minimum_length=20)
        and sender_configured
    )


async def deliver_otp(mobile: str, code: str) -> bool:
    """Send a one-time code. Returns False only for local debug delivery."""
    if not _twilio_is_configured():
        if settings.environment == "development":
            logger.info("Phone OTP generated for local development mobile=%s", mobile)
            return False
        raise OtpDeliveryUnavailableError()

    def _send() -> None:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        kwargs: dict[str, str] = {
            "body": f"Your Elitedom verification code is {code}. It expires in 5 minutes.",
            "to": mobile,
        }
        if settings.twilio_messaging_service_sid.strip():
            kwargs["messaging_service_sid"] = settings.twilio_messaging_service_sid.strip()
        else:
            kwargs["from_"] = settings.twilio_phone_number.strip()
        client.messages.create(**kwargs)

    try:
        await asyncio.to_thread(_send)
    except Exception as exc:
        logger.warning("Twilio OTP delivery failed: %s", type(exc).__name__)
        raise OtpDeliveryUnavailableError() from None
    return True

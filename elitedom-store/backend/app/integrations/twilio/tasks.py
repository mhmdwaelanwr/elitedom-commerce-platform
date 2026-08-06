"""
Elitedom Store — Twilio SMS Integration
Sends automated SMS notifications per TWILIO.md.
"""

import logging

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_sms(to: str, message: str) -> str:
    """Send an SMS message via Twilio API."""
    from twilio.rest import Client

    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    msg = client.messages.create(
        body=message,
        from_=settings.twilio_phone_number,
        to=to,
    )
    logger.info("SMS delivery accepted: SID=%s", msg.sid)
    return msg.sid


@celery_app.task(name="app.integrations.twilio.tasks.send_order_sms")
def send_order_sms(phone: str, order_number: str, status: str):
    """Send order status update via SMS."""
    messages = {
        "confirmed": f"✅ Elitedom: Order {order_number} confirmed! We're preparing your items.",
        "shipped": f"📦 Elitedom: Order {order_number} shipped! Track your delivery.",
        "delivered": f"🎉 Elitedom: Order {order_number} delivered! Thank you for shopping with us.",
    }
    message = messages.get(status, f"Elitedom: Order {order_number} status: {status}")
    return send_sms(phone, message)

"""Elitedom Store — SendGrid transactional email integration."""

import html
import logging
from urllib.parse import urlsplit

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _disabled_result(operation: str) -> dict[str, str]:
    logger.warning("SendGrid task skipped because SENDGRID_ENABLED=false: %s", operation)
    return {
        "status": "skipped",
        "provider": "sendgrid",
        "operation": operation,
        "reason": "disabled",
    }


def _validate_invoice_url(pdf_url: str) -> str:
    """Accept only absolute HTTPS invoice links without embedded credentials."""
    normalized = pdf_url.strip()
    parsed = urlsplit(normalized)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("pdf_url must be an absolute HTTPS URL without credentials")
    return normalized


def _send_message(message, operation: str, order_number: str) -> dict[str, str | int]:
    from sendgrid import SendGridAPIClient

    try:
        response = SendGridAPIClient(settings.sendgrid_api_key).send(message)
    except Exception:
        logger.exception("SendGrid failed: operation=%s order=%s", operation, order_number)
        raise

    logger.info(
        "SendGrid accepted email: operation=%s order=%s status=%s",
        operation,
        order_number,
        response.status_code,
    )
    return {
        "status": "accepted",
        "provider": "sendgrid",
        "operation": operation,
        "status_code": response.status_code,
    }


@celery_app.task(name="app.integrations.sendgrid.tasks.send_order_confirmation")
def send_order_confirmation(
    email: str, order_number: str, total: float
) -> dict[str, str | int]:
    """Send an order confirmation email with a receipt summary."""
    if not settings.sendgrid_enabled:
        return _disabled_result("order_confirmation")

    from sendgrid.helpers.mail import Mail

    safe_order_number = html.escape(order_number)
    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=email,
        subject=f"Elitedom — Order {order_number} Confirmed",
        html_content=(
            "<h1>Thank you for your order!</h1>"
            f"<p>Order Number: <strong>{safe_order_number}</strong></p>"
            f"<p>Total: <strong>EGP {total:,.2f}</strong></p>"
            "<p>We'll send you tracking details once your order ships.</p>"
            "<br><p>— Elitedom Store</p>"
        ),
    )
    return _send_message(message, "order_confirmation", order_number)


@celery_app.task(name="app.integrations.sendgrid.tasks.send_invoice_email")
def send_invoice_email(
    email: str, order_number: str, pdf_url: str
) -> dict[str, str | int]:
    """Send a secure link to the generated PDF invoice."""
    if not settings.sendgrid_enabled:
        return _disabled_result("invoice_email")

    from sendgrid.helpers.mail import Mail

    invoice_url = _validate_invoice_url(pdf_url)
    safe_order_number = html.escape(order_number)
    safe_invoice_url = html.escape(invoice_url, quote=True)
    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=email,
        subject=f"Elitedom — Invoice for Order {order_number}",
        html_content=(
            f"<p>Your invoice for order <strong>{safe_order_number}</strong> is ready.</p>"
            f'<p><a href="{safe_invoice_url}">Download your PDF invoice</a></p>'
            "<p>— Elitedom Store</p>"
        ),
    )
    return _send_message(message, "invoice_email", order_number)

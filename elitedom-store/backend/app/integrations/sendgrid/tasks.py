"""
Elitedom Store — SendGrid Email Integration
Automated receipts and PDF invoice delivery per SENDGRID.md.
"""

import logging

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@celery_app.task(name="app.integrations.sendgrid.tasks.send_order_confirmation")
def send_order_confirmation(email: str, order_number: str, total: float):
    """Send order confirmation email with receipt."""
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=email,
        subject=f"Elitedom — Order {order_number} Confirmed",
        html_content=f"""
        <h1>Thank you for your order!</h1>
        <p>Order Number: <strong>{order_number}</strong></p>
        <p>Total: <strong>EGP {total:,.2f}</strong></p>
        <p>We'll send you tracking details once your order ships.</p>
        <br>
        <p>— Elitedom Store</p>
        """,
    )

    try:
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)
        logger.info(
            "Order confirmation email accepted for order %s: status=%s",
            order_number,
            response.status_code,
        )
    except Exception:
        logger.exception("SendGrid failed to send order confirmation for %s", order_number)
        raise


@celery_app.task(name="app.integrations.sendgrid.tasks.send_invoice_email")
def send_invoice_email(email: str, order_number: str, pdf_url: str):
    """Send PDF invoice via email."""
    logger.info("Invoice email queued for order %s", order_number)
    # TODO: Implement with PDF attachment

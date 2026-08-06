"""Elitedom Store — Stripe Celery Tasks."""

from app.celery_app import celery_app


@celery_app.task(name="app.integrations.stripe.tasks.process_payment_webhook")
def process_payment_webhook(event_data: dict):
    """Process Stripe payment webhook asynchronously."""
    pass

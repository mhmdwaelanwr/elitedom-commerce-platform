"""Elitedom Store — Zeptomail Transactional Email Integration"""

import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.integrations.zeptomail.tasks.send_transactional_email")
def send_transactional_email(email: str, subject: str, body: str):
    """Send transactional email via Zeptomail API."""
    logger.info("Zeptomail transactional email queued")
    # TODO: Implement Zeptomail API call

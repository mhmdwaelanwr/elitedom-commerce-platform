"""Elitedom Store — ZeptoMail transactional email integration."""

import logging

import httpx

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@celery_app.task(name="app.integrations.zeptomail.tasks.send_transactional_email")
def send_transactional_email(
    email: str, subject: str, body: str
) -> dict[str, str | int | None]:
    """Send one transactional email through the ZeptoMail REST API."""
    if not settings.zeptomail_enabled:
        logger.warning(
            "ZeptoMail task skipped because ZEPTOMAIL_ENABLED=false: subject=%s",
            subject,
        )
        return {
            "status": "skipped",
            "provider": "zeptomail",
            "reason": "disabled",
        }

    payload = {
        "from": {
            "address": settings.zeptomail_from_email,
            "name": settings.zeptomail_from_name,
        },
        "to": [{"email_address": {"address": email}}],
        "subject": subject,
        "htmlbody": body,
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"zoho-enczapikey {settings.zeptomail_api_key}",
    }

    try:
        response = httpx.post(
            settings.zeptomail_api_url,
            headers=headers,
            json=payload,
            timeout=15.0,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("ZeptoMail failed to send transactional email")
        raise

    response_data = response.json() if response.content else {}
    request_id = response_data.get("request_id")
    logger.info(
        "ZeptoMail accepted transactional email: status=%s request_id=%s",
        response.status_code,
        request_id,
    )
    return {
        "status": "accepted",
        "provider": "zeptomail",
        "status_code": response.status_code,
        "request_id": request_id,
    }

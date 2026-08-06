"""Transactional outbox primitives for reliable integration hand-off.

The application must never depend on an in-process event handler completing
before a customer-facing transaction can be committed.  This module writes a
compact, sanitized event record alongside the business mutation, then asks a
Celery dispatcher to process it only after the transaction commits.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import OutboxEvent
from app.shared.events import DomainEvent, event_bus

logger = logging.getLogger(__name__)

OUTBOX_PENDING = "pending"
OUTBOX_PROCESSING = "processing"
OUTBOX_DISPATCHED = "dispatched"
OUTBOX_SKIPPED = "skipped"
OUTBOX_DEAD_LETTER = "dead_letter"

# The durable integration envelope should carry references, not customer PII.
# Integration workers load the current record by id when a provider genuinely
# needs customer data, subject to that worker's own authorization and logging.
_SENSITIVE_PAYLOAD_KEYS = {
    "address",
    "address_line_2",
    "customer_email",
    "customer_mobile",
    "email",
    "evidence_media_url",
    "phone",
    "recipient_phone",
    "shipping_address",
    "street_address",
}


def _event_source(event: DomainEvent, source_context: str | None) -> str:
    """Resolve a stable source while repairing legacy event subclasses.

    ``DomainEvent`` is a dataclass and the older subclasses declare their
    source as a class attribute.  Instances therefore retained the inherited
    empty default.  Resolve that class value here so stored events stay useful
    without requiring every existing caller to change its constructor.
    """

    source = source_context or event.source_context
    if not source:
        source = getattr(type(event), "source_context", "")
    normalized = str(source or "application").strip().lower()
    event.source_context = normalized
    return normalized[:64]


def _json_safe(value: Any, *, key: str | None = None) -> Any:
    """Return a JSON-safe, PII-minimized representation of an event payload."""

    if key and key.lower() in _SENSITIVE_PAYLOAD_KEYS:
        return "<redacted>"
    if isinstance(value, dict):
        return {
            str(item_key): _json_safe(item_value, key=str(item_key))
            for item_key, item_value in value.items()
        }
    if isinstance(value, list | tuple | set):
        return [_json_safe(item) for item in value]
    if isinstance(value, datetime | date | Decimal | Enum):
        return str(value.value if isinstance(value, Enum) else value)
    if value is None or isinstance(value, str | int | float | bool):
        return value
    return str(value)


def _normalized_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Make JSON serialization failures impossible at transaction commit time."""

    sanitized = _json_safe(payload)
    # Round trip catches unsupported custom types early and produces plain JSON
    # values for PostgreSQL JSON as well as SQLite-backed tests.
    return json.loads(json.dumps(sanitized, sort_keys=True, default=str))


class OutboxService:
    """Async outbox writer used inside FastAPI business transactions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def enqueue(
        self,
        event: DomainEvent,
        *,
        source_context: str | None = None,
    ) -> OutboxEvent:
        record = OutboxEvent(
            event_id=event.event_id,
            event_type=event.event_type,
            source_context=_event_source(event, source_context),
            payload=_normalized_payload(event.payload),
            status=OUTBOX_PENDING,
        )
        self.db.add(record)
        # ``flush`` gives callers an id while preserving the outer transaction.
        await self.db.flush()
        self.db.info["outbox_dispatch_requested"] = True
        return record


class SyncOutboxService:
    """Synchronous variant for Celery/Odoo worker transactions."""

    def __init__(self, db: Session):
        self.db = db

    def enqueue(
        self,
        event: DomainEvent,
        *,
        source_context: str | None = None,
    ) -> OutboxEvent:
        record = OutboxEvent(
            event_id=event.event_id,
            event_type=event.event_type,
            source_context=_event_source(event, source_context),
            payload=_normalized_payload(event.payload),
            status=OUTBOX_PENDING,
        )
        self.db.add(record)
        self.db.flush()
        self.db.info["outbox_dispatch_requested"] = True
        return record


async def publish_domain_event(
    db: AsyncSession,
    event: DomainEvent,
    *,
    source_context: str | None = None,
) -> OutboxEvent:
    """Persist a domain event transactionally and notify in-process listeners.

    The outbox record is deliberately written *before* the event bus fan-out.
    Event bus handlers are best-effort convenience hooks; durable integrations
    consume the record later and therefore survive process crashes or handler
    failures.
    """

    record = await OutboxService(db).enqueue(event, source_context=source_context)
    await event_bus.publish(event)
    return record


def enqueue_domain_event_sync(
    db: Session,
    event: DomainEvent,
    *,
    source_context: str | None = None,
) -> OutboxEvent:
    """Persist an event in a synchronous worker transaction."""

    return SyncOutboxService(db).enqueue(event, source_context=source_context)


def request_outbox_dispatch() -> None:
    """Best-effort post-commit wake-up for the durable Celery dispatcher.

    A broker outage must not roll back an already committed customer order.
    The beat schedule will pick up the pending database event after recovery.
    """

    try:
        from app.shared.outbox_tasks import dispatch_pending_outbox

        dispatch_pending_outbox.delay()
    except Exception:
        logger.warning(
            "Transactional outbox was committed but could not wake Celery; "
            "the scheduled dispatcher will retry it.",
            exc_info=True,
        )

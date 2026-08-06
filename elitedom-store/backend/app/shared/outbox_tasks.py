"""Celery delivery worker for the transactional integration outbox.

This worker only acknowledges that a downstream Celery task was accepted by
the broker.  It never represents that hand-off as a successful Odoo/Stripe
operation; those integration tasks retain their own verified result and retry
semantics.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, create_engine, or_, select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.config import get_settings
from app.models import OutboxEvent
from app.shared.outbox import (
    OUTBOX_DEAD_LETTER,
    OUTBOX_DISPATCHED,
    OUTBOX_PENDING,
    OUTBOX_PROCESSING,
    OUTBOX_SKIPPED,
)

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_OUTBOX_ATTEMPTS = 5
LEASE_SECONDS = 120
DEFAULT_BATCH_SIZE = 100


@dataclass(frozen=True)
class ClaimedOutboxEvent:
    """A delivery-safe snapshot captured under the database row lock."""

    id: int
    event_type: str
    source_context: str
    payload: dict[str, Any]
    attempts: int


@dataclass(frozen=True)
class IntegrationRoute:
    """One permitted hand-off from a domain event to a Celery integration task."""

    task_name: str
    args_from_payload: Callable[[dict[str, Any]], tuple[Any, ...]]
    target_context: str


_routes: dict[str, IntegrationRoute] = {}
_routes_registered = False


def _order_id_args(payload: dict[str, Any]) -> tuple[int]:
    value = payload.get("order_id")
    if isinstance(value, bool):
        raise ValueError("order_id must be a positive integer.")
    try:
        order_id = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError("order_id is required for Odoo order synchronization.") from error
    if order_id < 1:
        raise ValueError("order_id must be a positive integer.")
    return (order_id,)


def _product_id_args(payload: dict[str, Any]) -> tuple[int]:
    """Extract the minimal durable reference needed to reindex one product."""
    value = payload.get("product_id")
    if isinstance(value, bool):
        raise ValueError("product_id must be a positive integer.")
    try:
        product_id = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError("product_id is required for Algolia product indexing.") from error
    if product_id < 1:
        raise ValueError("product_id must be a positive integer.")
    return (product_id,)


def register_default_outbox_routes() -> None:
    """Register the safe, implemented integration hand-offs.

    The routing table is deliberately a whitelist.  Each route carries its
    target context so an inbound Odoo event can still fan out to Algolia while
    never being echoed back into Odoo.
    """

    global _routes_registered
    if _routes_registered:
        return

    odoo_order_route = IntegrationRoute(
        task_name="app.integrations.odoo.tasks.sync_order_to_odoo",
        args_from_payload=_order_id_args,
        target_context="odoo",
    )
    for event_type in ("OrderCreated", "OrderConfirmed", "PaymentSucceeded"):
        _routes[event_type] = odoo_order_route

    algolia_product_route = IntegrationRoute(
        task_name="app.integrations.algolia.tasks.index_product",
        args_from_payload=_product_id_args,
        target_context="algolia",
    )
    for event_type in ("ProductCreated", "ProductUpdated", "InventoryUpdated"):
        _routes[event_type] = algolia_product_route
    _routes_registered = True


def resolve_outbox_route(event: ClaimedOutboxEvent) -> IntegrationRoute | None:
    """Resolve only safe, one-way integrations for an outbox event."""

    register_default_outbox_routes()
    route = _routes.get(event.event_type)
    if route is None:
        return None
    # An inbound Odoo event must never be echoed back to the ERP.  It may,
    # however, legitimately update the shopper-facing Algolia index (notably
    # inventory webhooks and periodic inventory syncs).
    if route.target_context == "odoo" and event.source_context.casefold().startswith("odoo"):
        return None
    return route


@contextmanager
def _sync_database_session() -> Iterator[Session]:
    """Create one short synchronous session in the Celery worker process."""

    engine = create_engine(settings.database_url_sync, pool_pre_ping=True)
    session = Session(engine, expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


def _now() -> datetime:
    return datetime.now(UTC)


def _claim_due_events(limit: int) -> list[ClaimedOutboxEvent]:
    """Lease due records so concurrent workers cannot dispatch them twice."""

    now = _now()
    due = or_(
        and_(
            OutboxEvent.status == OUTBOX_PENDING,
            OutboxEvent.available_at <= now,
        ),
        and_(
            OutboxEvent.status == OUTBOX_PROCESSING,
            OutboxEvent.locked_until.is_not(None),
            OutboxEvent.locked_until <= now,
        ),
    )
    with _sync_database_session() as db:
        events = (
            db.execute(
                select(OutboxEvent)
                .where(due)
                .order_by(OutboxEvent.available_at, OutboxEvent.id)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )
        claimed: list[ClaimedOutboxEvent] = []
        for event in events:
            event.status = OUTBOX_PROCESSING
            event.attempts += 1
            event.locked_until = now + timedelta(seconds=LEASE_SECONDS)
            claimed.append(
                ClaimedOutboxEvent(
                    id=event.id,
                    event_type=event.event_type,
                    source_context=event.source_context,
                    payload=dict(event.payload),
                    attempts=event.attempts,
                )
            )
        db.flush()
        return claimed


def _mark_dispatched(event: ClaimedOutboxEvent, task_name: str) -> None:
    """Record a broker hand-off, not an external provider success."""

    with _sync_database_session() as db:
        record = db.get(OutboxEvent, event.id)
        if record is None or record.status != OUTBOX_PROCESSING:
            return
        record.status = OUTBOX_DISPATCHED
        record.dispatched_task = task_name
        record.dispatched_at = _now()
        record.locked_until = None
        record.last_error = None
        db.flush()


def _mark_skipped(event: ClaimedOutboxEvent, reason: str) -> None:
    """Persist a transparent terminal state for an intentionally unsupported route."""

    with _sync_database_session() as db:
        record = db.get(OutboxEvent, event.id)
        if record is None or record.status != OUTBOX_PROCESSING:
            return
        record.status = OUTBOX_SKIPPED
        record.locked_until = None
        record.last_error = reason[:2000]
        db.flush()


def _mark_dead_letter(event: ClaimedOutboxEvent, reason: str) -> None:
    """Stop retrying a malformed event that no handler can safely process."""

    with _sync_database_session() as db:
        record = db.get(OutboxEvent, event.id)
        if record is None or record.status != OUTBOX_PROCESSING:
            return
        record.status = OUTBOX_DEAD_LETTER
        record.locked_until = None
        record.last_error = reason[:2000]
        db.flush()


def _retry_delay_seconds(attempts: int) -> int:
    return min(300, 5 * (3 ** max(attempts - 1, 0)))


def _mark_dispatch_failure(event: ClaimedOutboxEvent, error: Exception) -> str:
    """Return a durable retry/dead-letter result after a broker failure."""

    with _sync_database_session() as db:
        record = db.get(OutboxEvent, event.id)
        if record is None or record.status != OUTBOX_PROCESSING:
            return "ignored"
        record.locked_until = None
        record.last_error = str(error)[:2000]
        if record.attempts >= MAX_OUTBOX_ATTEMPTS:
            record.status = OUTBOX_DEAD_LETTER
            db.flush()
            return OUTBOX_DEAD_LETTER
        record.status = OUTBOX_PENDING
        record.available_at = _now() + timedelta(seconds=_retry_delay_seconds(record.attempts))
        db.flush()
        return OUTBOX_PENDING


@celery_app.task(name="app.shared.outbox_tasks.dispatch_pending_outbox")
def dispatch_pending_outbox(limit: int = DEFAULT_BATCH_SIZE) -> dict[str, int]:
    """Hand off due durable events to real Celery integration tasks.

    The periodic caller and post-commit wake-up both invoke this task.  A
    worker crash after broker submission can produce a duplicate hand-off once
    the lease expires, so every routed target must remain idempotent.  The
    existing Odoo order task meets that requirement using the local order id
    and its client order reference.
    """

    bounded_limit = max(1, min(int(limit), DEFAULT_BATCH_SIZE))
    claimed = _claim_due_events(bounded_limit)
    result = {
        "claimed": len(claimed),
        "dispatched": 0,
        "skipped": 0,
        "retrying": 0,
        "dead_letter": 0,
    }

    for event in claimed:
        route = resolve_outbox_route(event)
        if route is None:
            _mark_skipped(
                event,
                "No active integration route is registered for this event source/type.",
            )
            result["skipped"] += 1
            continue

        try:
            args = route.args_from_payload(event.payload)
        except ValueError as error:
            _mark_dead_letter(event, f"Invalid outbox payload: {error}")
            result["dead_letter"] += 1
            continue

        try:
            celery_app.send_task(route.task_name, args=args)
        except Exception as error:
            outcome = _mark_dispatch_failure(event, error)
            if outcome == OUTBOX_DEAD_LETTER:
                result["dead_letter"] += 1
            elif outcome == OUTBOX_PENDING:
                result["retrying"] += 1
            logger.warning(
                "Outbox event %s could not be handed to %s: %s",
                event.id,
                route.task_name,
                error,
            )
            continue

        _mark_dispatched(event, route.task_name)
        result["dispatched"] += 1

    return result


# Celery workers import task modules without starting FastAPI.  Register the
# whitelist at import time as well as during the API lifespan.
register_default_outbox_routes()

"""Focused coverage for durable, one-way integration event dispatch."""

from unittest.mock import Mock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent
from app.shared import outbox_tasks
from app.shared.events import CustomerRegistered
from app.shared.outbox import OUTBOX_PENDING, publish_domain_event
from app.shared.outbox_tasks import ClaimedOutboxEvent


@pytest.mark.asyncio
async def test_domain_event_is_persisted_with_the_business_transaction(
    db_session: AsyncSession,
) -> None:
    record = await publish_domain_event(
        db_session,
        CustomerRegistered(payload={"user_id": 42, "email": "customer@example.test"}),
    )

    assert record.id is not None
    assert record.status == OUTBOX_PENDING
    assert record.event_type == "CustomerRegistered"
    assert record.source_context == "customer"
    assert record.payload == {"email": "<redacted>", "user_id": 42}
    assert db_session.info["outbox_dispatch_requested"] is True

    await db_session.commit()
    persisted = await db_session.get(OutboxEvent, record.id)
    assert persisted is not None
    assert persisted.event_id == record.event_id


def test_odoo_originated_events_cannot_be_echoed_back_to_odoo() -> None:
    inbound_event = ClaimedOutboxEvent(
        id=1,
        event_type="OrderConfirmed",
        source_context="odoo_webhook",
        payload={"order_id": 123},
        attempts=1,
    )

    assert outbox_tasks.resolve_outbox_route(inbound_event) is None


@pytest.mark.parametrize("event_type", ("ProductCreated", "ProductUpdated", "InventoryUpdated"))
def test_catalog_events_route_to_algolia_by_product_id(event_type: str) -> None:
    event = ClaimedOutboxEvent(
        id=2,
        event_type=event_type,
        source_context="inventory" if event_type == "InventoryUpdated" else "product",
        payload={"product_id": 456, "sku": "SAFE-CATALOG-456"},
        attempts=1,
    )

    route = outbox_tasks.resolve_outbox_route(event)

    assert route is not None
    assert route.task_name == "app.integrations.algolia.tasks.index_product"
    assert route.args_from_payload(event.payload) == (456,)


def test_odoo_inventory_update_routes_to_algolia_without_echoing_to_odoo() -> None:
    event = ClaimedOutboxEvent(
        id=3,
        event_type="InventoryUpdated",
        source_context="odoo_webhook",
        payload={"product_id": 457, "sku": "ODOO-STOCK-457"},
        attempts=1,
    )

    route = outbox_tasks.resolve_outbox_route(event)

    assert route is not None
    assert route.task_name == "app.integrations.algolia.tasks.index_product"
    assert route.args_from_payload(event.payload) == (457,)


def test_algolia_product_route_rejects_invalid_product_reference() -> None:
    event = ClaimedOutboxEvent(
        id=4,
        event_type="ProductUpdated",
        source_context="product",
        payload={"product_id": False},
        attempts=1,
    )
    route = outbox_tasks.resolve_outbox_route(event)

    assert route is not None
    with pytest.raises(ValueError, match="product_id"):
        route.args_from_payload(event.payload)


def test_dispatcher_marks_only_broker_accepted_event_as_dispatched(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event = ClaimedOutboxEvent(
        id=8,
        event_type="OrderCreated",
        source_context="order",
        payload={"order_id": 123},
        attempts=1,
    )
    sent = Mock()
    marked_dispatched = Mock()

    monkeypatch.setattr(outbox_tasks, "_claim_due_events", lambda _limit: [event])
    monkeypatch.setattr(outbox_tasks.celery_app, "send_task", sent)
    monkeypatch.setattr(outbox_tasks, "_mark_dispatched", marked_dispatched)

    result = outbox_tasks.dispatch_pending_outbox.run(limit=1)

    assert result == {
        "claimed": 1,
        "dispatched": 1,
        "skipped": 0,
        "retrying": 0,
        "dead_letter": 0,
    }
    sent.assert_called_once_with("app.integrations.odoo.tasks.sync_order_to_odoo", args=(123,))
    marked_dispatched.assert_called_once_with(
        event, "app.integrations.odoo.tasks.sync_order_to_odoo"
    )


def test_dispatcher_hands_catalog_change_to_algolia(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event = ClaimedOutboxEvent(
        id=10,
        event_type="ProductUpdated",
        source_context="product",
        payload={"product_id": 458},
        attempts=1,
    )
    sent = Mock()
    marked_dispatched = Mock()

    monkeypatch.setattr(outbox_tasks, "_claim_due_events", lambda _limit: [event])
    monkeypatch.setattr(outbox_tasks.celery_app, "send_task", sent)
    monkeypatch.setattr(outbox_tasks, "_mark_dispatched", marked_dispatched)

    result = outbox_tasks.dispatch_pending_outbox.run(limit=1)

    assert result["dispatched"] == 1
    assert result["skipped"] == 0
    sent.assert_called_once_with("app.integrations.algolia.tasks.index_product", args=(458,))
    marked_dispatched.assert_called_once_with(event, "app.integrations.algolia.tasks.index_product")


def test_dispatcher_does_not_report_broker_failure_as_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event = ClaimedOutboxEvent(
        id=9,
        event_type="PaymentSucceeded",
        source_context="stripe_webhook",
        payload={"order_id": 124},
        attempts=1,
    )
    marked_dispatched = Mock()
    marked_failure = Mock(return_value=OUTBOX_PENDING)

    monkeypatch.setattr(outbox_tasks, "_claim_due_events", lambda _limit: [event])
    monkeypatch.setattr(
        outbox_tasks.celery_app,
        "send_task",
        Mock(side_effect=ConnectionError("redis unavailable")),
    )
    monkeypatch.setattr(outbox_tasks, "_mark_dispatched", marked_dispatched)
    monkeypatch.setattr(outbox_tasks, "_mark_dispatch_failure", marked_failure)

    result = outbox_tasks.dispatch_pending_outbox.run(limit=1)

    assert result["dispatched"] == 0
    assert result["retrying"] == 1
    assert result["dead_letter"] == 0
    marked_dispatched.assert_not_called()
    marked_failure.assert_called_once()

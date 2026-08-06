"""
Elitedom Store — Domain Event Bus
Event-driven communication between bounded contexts.
Per DOMAIN_MODEL.md Section 8: Domain Events.
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

# Type alias for async event handlers
EventHandler = Callable[["DomainEvent"], Coroutine[Any, Any, None]]


@dataclass
class DomainEvent:
    """Base class for all domain events."""

    event_id: str = field(default_factory=lambda: str(uuid4()))
    event_type: str = ""
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    payload: dict = field(default_factory=dict)
    source_context: str = ""  # The bounded context that emitted this event

    def __post_init__(self):
        if not self.event_type:
            self.event_type = self.__class__.__name__
        # Existing subclasses expose their domain as a class attribute.  The
        # inherited dataclass field otherwise keeps its empty default on each
        # instance, which made event/audit routing lose the source context.
        if not self.source_context:
            self.source_context = getattr(type(self), "source_context", "")


# ── Concrete Domain Events ──────────────────────────────────────────────────


class CustomerRegistered(DomainEvent):
    source_context: str = "Customer"


class ProductCreated(DomainEvent):
    source_context: str = "Product"


class ProductUpdated(DomainEvent):
    source_context: str = "Product"


class InventoryUpdated(DomainEvent):
    source_context: str = "Inventory"


class CartCheckedOut(DomainEvent):
    source_context: str = "Order"


class OrderCreated(DomainEvent):
    source_context: str = "Order"


class OrderConfirmed(DomainEvent):
    source_context: str = "Order"


class OrderShipped(DomainEvent):
    source_context: str = "Shipping"


class OrderDelivered(DomainEvent):
    source_context: str = "Shipping"


class OrderCancelled(DomainEvent):
    source_context: str = "Order"


class PaymentSucceeded(DomainEvent):
    source_context: str = "Payment"


class PaymentFailed(DomainEvent):
    source_context: str = "Payment"


class PaymentRefundRequested(DomainEvent):
    """A refund requires finance/Stripe review; it is not a completed refund."""

    source_context: str = "Payment"


class PaymentRefunded(DomainEvent):
    source_context: str = "Payment"


class DropshipFulfillmentRequested(DomainEvent):
    source_context: str = "Dropship"


class ShipmentCreated(DomainEvent):
    source_context: str = "Shipping"


class WarrantyRegistered(DomainEvent):
    source_context: str = "Warranty"


class WarrantyClaimSubmitted(DomainEvent):
    source_context: str = "Warranty"


class SupportTicketCreated(DomainEvent):
    source_context: str = "Support"


class LoyaltyPointsEarned(DomainEvent):
    source_context: str = "Loyalty"


class LoyaltyPointsRedeemed(DomainEvent):
    source_context: str = "Loyalty"


# ── Event Bus ────────────────────────────────────────────────────────────────


class EventBus:
    """
    In-process async event bus for domain event dispatch.

    Respects the context integration rules from CONTEXT_MAP.md:
    - Contexts may not access another context's database directly.
    - Communication must occur through Domain Events.
    """

    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register a handler for a specific event type."""
        self._handlers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type}")

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Remove a handler for a specific event type."""
        self._handlers[event_type].remove(handler)

    async def publish(self, event: DomainEvent) -> None:
        """
        Publish a domain event to all subscribed handlers.
        Handlers are executed concurrently via asyncio.gather.
        """
        event_type = event.event_type
        handlers = self._handlers.get(event_type, [])

        if not handlers:
            logger.debug(f"No handlers for event: {event_type}")
            return

        logger.info(
            f"Publishing {event_type} from {event.source_context} " f"to {len(handlers)} handler(s)"
        )

        tasks = [handler(event) for handler in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for handler, result in zip(handlers, results, strict=False):
            if isinstance(result, Exception):
                logger.error(f"Handler {handler.__name__} failed for {event_type}: {result}")


# Global event bus singleton
event_bus = EventBus()

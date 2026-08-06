"""Signed Odoo ERP webhook handlers.

Odoo is the source of truth for inventory and fulfillment status.  These
endpoints therefore intentionally do *not* use a customer JWT or order-owner
check: a request is authorized by the HMAC dependency and then applied as a
trusted integration update.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.webhook_signature import verify_odoo_webhook
from app.models import ProductTemplate, SaleOrder, StockPicking, WebhookReceipt
from app.shared.events import (
    InventoryUpdated,
    OrderCancelled,
    OrderConfirmed,
    OrderDelivered,
    OrderShipped,
)
from app.shared.exceptions import ResourceNotFoundError
from app.shared.outbox import publish_domain_event

logger = logging.getLogger(__name__)
router = APIRouter()

VerifiedOdooBody = Annotated[bytes, Depends(verify_odoo_webhook)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
IdempotencyKey = Annotated[str | None, Header(alias="X-Idempotency-Key")]


# Odoo's public values are deliberately accepted alongside the local values.
# ``SaleOrder.state`` uses Odoo's canonical draft/sent/sale/done/cancel values,
# while the human-facing "shipped" status is represented by the picking state.
ORDER_STATE_BY_ODOO_STATUS = {
    "draft": "draft",
    "sent": "sent",
    "confirmed": "sale",
    "sale": "sale",
    "paid": "sale",
    "processing": "sale",
    "invoiced": "sale",
    "shipped": "sale",
    "delivered": "done",
    "done": "done",
    "cancel": "cancel",
    "cancelled": "cancel",
    "canceled": "cancel",
}
PICKING_STATE_BY_ODOO_STATUS = {
    "draft": "draft",
    "sent": "waiting",
    "confirmed": "confirmed",
    "sale": "assigned",
    "paid": "assigned",
    "processing": "assigned",
    "invoiced": "assigned",
    "shipped": "done",
    "delivered": "done",
    "done": "done",
    "cancel": "cancel",
    "cancelled": "cancel",
    "canceled": "cancel",
}
EVENT_CLASS_BY_ODOO_STATUS = {
    "confirmed": OrderConfirmed,
    "sale": OrderConfirmed,
    "paid": OrderConfirmed,
    "processing": OrderConfirmed,
    "invoiced": OrderConfirmed,
    "shipped": OrderShipped,
    "delivered": OrderDelivered,
    "done": OrderDelivered,
    "cancel": OrderCancelled,
    "cancelled": OrderCancelled,
    "canceled": OrderCancelled,
}

# An Odoo delivery can arrive more than once and not necessarily in lifecycle
# order.  ``SaleOrder.state`` intentionally has no separate ``shipped`` value,
# so the latest picking supplies that intermediate stage.  These stages are
# used only at the integration boundary; they prevent a delayed ``confirmed``
# or ``sent`` message from reopening a delivered local order.
ORDER_LIFECYCLE_STAGE_BY_ODOO_STATUS = {
    "draft": 0,
    "sent": 1,
    "confirmed": 2,
    "sale": 2,
    "paid": 2,
    "processing": 2,
    "invoiced": 2,
    "shipped": 3,
    "delivered": 4,
    "done": 4,
}
ORDER_LIFECYCLE_STAGE_BY_ORDER_STATE = {
    "draft": 0,
    "sent": 1,
    "sale": 2,
    "done": 4,
}
ORDER_LIFECYCLE_STAGE_BY_PICKING_STATE = {
    "draft": 0,
    "waiting": 1,
    "confirmed": 2,
    "assigned": 2,
    # The local picking model represents carrier dispatch as ``done``.  The
    # SaleOrder remains ``sale`` until Odoo reports delivered/done, which lets
    # us distinguish shipped (3) from delivered (4) without another column.
    "done": 3,
}
ODOO_CANCELLATION_STATUSES = {"cancel", "cancelled", "canceled"}


class _OdooWebhookPayload(BaseModel):
    """Fields shared by signed Odoo messages.

    An event id is preferred.  When an older Odoo automation cannot supply
    one, the raw payload hash becomes an idempotency key instead.
    """

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    event_id: str | None = Field(default=None, min_length=1, max_length=120)
    timestamp: datetime

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class InventoryWebhookPayload(_OdooWebhookPayload):
    product_sku: str = Field(..., min_length=1, max_length=64)
    new_quantity: int = Field(..., ge=0)
    warehouse_location: str | None = Field(default=None, max_length=128)


class OrderStatusWebhookPayload(_OdooWebhookPayload):
    order_reference: str = Field(..., min_length=1, max_length=64)
    new_status: str = Field(..., min_length=1, max_length=32)
    tracking_number: str | None = Field(default=None, max_length=128)
    carrier: str | None = Field(default=None, max_length=128)
    picking_reference: str | None = Field(default=None, max_length=64)
    odoo_order_id: int | None = Field(default=None, ge=1)

    @field_validator("new_status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "_")
        if normalized not in ORDER_STATE_BY_ODOO_STATUS:
            supported = ", ".join(sorted(ORDER_STATE_BY_ODOO_STATUS))
            raise ValueError(f"Unsupported Odoo order status. Supported values: {supported}")
        return normalized


PayloadModel = TypeVar("PayloadModel", bound=BaseModel)


def _parse_payload(body: bytes, payload_type: type[PayloadModel]) -> PayloadModel:
    """Decode and structurally validate an already-authenticated JSON body."""
    try:
        raw_payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        logger.warning("Odoo webhook contained invalid JSON")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid Odoo webhook JSON payload.",
        ) from error

    if not isinstance(raw_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Odoo webhook payload must be a JSON object.",
        )

    try:
        return payload_type.model_validate(raw_payload)
    except ValidationError as error:
        logger.warning("Odoo webhook payload validation failed: %s", error.errors())
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid Odoo webhook payload fields.",
        ) from error


def _event_key(body: bytes, event_id: str | None, idempotency_key: str | None) -> str:
    """Return a deterministic key scoped by the Odoo source in the receipt table."""
    supplied_key = (event_id or idempotency_key or "").strip()
    if supplied_key:
        return f"event:{supplied_key}"[:128]
    return f"sha256:{hashlib.sha256(body).hexdigest()}"


async def _claim_delivery(
    db: AsyncSession,
    *,
    body: bytes,
    event_key: str,
    event_type: str,
) -> bool:
    """Persist a receipt before mutating state; return False for a duplicate."""
    existing = await db.scalar(
        select(WebhookReceipt.id).where(
            WebhookReceipt.source == "odoo",
            WebhookReceipt.event_key == event_key,
        )
    )
    if existing is not None:
        return False

    db.add(
        WebhookReceipt(
            source="odoo",
            event_key=event_key,
            event_type=event_type,
            payload_sha256=hashlib.sha256(body).hexdigest(),
        )
    )
    try:
        await db.flush()
    except IntegrityError:
        # A concurrent delivery won the unique-key race.  There are no state
        # mutations before this point, so rolling back is safe and makes the
        # session usable for FastAPI's normal response lifecycle.
        await db.rollback()
        return False
    return True


def _picking_name(order: SaleOrder, payload: OrderStatusWebhookPayload) -> str:
    return (payload.picking_reference or f"ODOO-{order.name}")[:64]


async def _get_or_create_picking(
    db: AsyncSession,
    order: SaleOrder,
    payload: OrderStatusWebhookPayload,
) -> StockPicking:
    """Find the relevant delivery order or create a local mirror for it."""
    if payload.picking_reference:
        picking = await db.scalar(
            select(StockPicking).where(StockPicking.name == payload.picking_reference)
        )
        if picking is not None:
            return picking

    picking = await db.scalar(
        select(StockPicking)
        .where(StockPicking.sale_id == order.id)
        .order_by(StockPicking.id.desc())
        .limit(1)
    )
    if picking is not None:
        return picking

    picking = StockPicking(
        name=_picking_name(order, payload),
        sale_id=order.id,
        picking_type="dropship" if order.is_dropship else "outgoing",
        state=PICKING_STATE_BY_ODOO_STATUS[payload.new_status],
    )
    db.add(picking)
    await db.flush()
    return picking


async def _latest_picking(db: AsyncSession, order: SaleOrder) -> StockPicking | None:
    """Load the current delivery mirror without creating a stale one."""
    return await db.scalar(
        select(StockPicking)
        .where(StockPicking.sale_id == order.id)
        .order_by(StockPicking.id.desc())
        .limit(1)
    )


def _current_lifecycle_stage(order: SaleOrder, picking: StockPicking | None) -> int | None:
    """Return the current forward-only fulfillment stage or a terminal marker.

    ``None`` denotes cancellation.  A cancellation may never be reopened by a
    later webhook, and an order/picking that is already complete takes
    precedence over older non-terminal messages.
    """
    if order.state == "cancel" or (picking is not None and picking.state == "cancel"):
        return None

    order_stage = ORDER_LIFECYCLE_STAGE_BY_ORDER_STATE.get(order.state, 0)
    picking_stage = (
        ORDER_LIFECYCLE_STAGE_BY_PICKING_STATE.get(picking.state, 0) if picking is not None else 0
    )
    return max(order_stage, picking_stage)


def _can_apply_lifecycle_update(
    order: SaleOrder,
    picking: StockPicking | None,
    new_status: str,
) -> bool:
    """Allow only forward Odoo fulfillment transitions.

    Odoo's retries are deduplicated by receipt, while a distinct, delayed
    event is a legitimate delivery that must be acknowledged but ignored when
    it would regress the lifecycle.  Cancellation is terminal and is only
    accepted before shipment; delivery is terminal too.
    """
    current_stage = _current_lifecycle_stage(order, picking)
    if current_stage is None:
        return False
    if new_status in ODOO_CANCELLATION_STATUSES:
        return current_stage < ORDER_LIFECYCLE_STAGE_BY_ODOO_STATUS["shipped"]
    target_stage = ORDER_LIFECYCLE_STAGE_BY_ODOO_STATUS[new_status]
    return target_stage > current_stage


@router.post("/inventory")
async def odoo_inventory_webhook(
    body: VerifiedOdooBody,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
):
    """Persist an HMAC-authenticated stock level update from Odoo."""
    payload = _parse_payload(body, InventoryWebhookPayload)
    event_key = _event_key(body, payload.event_id, idempotency_key)
    if not await _claim_delivery(
        db, body=body, event_key=event_key, event_type="inventory.stock.updated"
    ):
        logger.info("Ignoring duplicate Odoo inventory webhook: %s", event_key)
        return {"status": "duplicate", "event_key": event_key, "sku": payload.product_sku}

    product = await db.scalar(
        select(ProductTemplate).where(ProductTemplate.sku == payload.product_sku)
    )
    if product is None:
        raise ResourceNotFoundError("Product SKU", payload.product_sku)

    previous_quantity = product.stock_qty
    product.stock_qty = payload.new_quantity
    await db.flush()

    if previous_quantity != payload.new_quantity:
        await publish_domain_event(
            db,
            InventoryUpdated(
                payload={
                    "product_id": product.id,
                    "sku": product.sku,
                    "previous_quantity": previous_quantity,
                    "new_quantity": payload.new_quantity,
                    "warehouse_location": payload.warehouse_location,
                    "event_key": event_key,
                    "occurred_at": payload.timestamp.isoformat(),
                }
            ),
            source_context="odoo_webhook",
        )

    logger.info(
        "Applied Odoo inventory update: sku=%s previous=%s current=%s event=%s",
        product.sku,
        previous_quantity,
        payload.new_quantity,
        event_key,
    )
    return {
        "status": "processed",
        "event_key": event_key,
        "sku": product.sku,
        "stock_qty": product.stock_qty,
        "changed": previous_quantity != payload.new_quantity,
    }


@router.post("/order-status")
async def odoo_order_status_webhook(
    body: VerifiedOdooBody,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
):
    """Apply a trusted Odoo lifecycle and tracking update to a local order.

    The lookup deliberately uses only Odoo's order reference.  Webhooks are
    authenticated at the integration boundary and must not be constrained by
    whichever customer owns the sale order.
    """
    payload = _parse_payload(body, OrderStatusWebhookPayload)
    event_key = _event_key(body, payload.event_id, idempotency_key)
    if not await _claim_delivery(
        db, body=body, event_key=event_key, event_type="sale.order.status.updated"
    ):
        logger.info("Ignoring duplicate Odoo order-status webhook: %s", event_key)
        return {
            "status": "duplicate",
            "event_key": event_key,
            "order_reference": payload.order_reference,
        }

    # Serialize distinct status events for the same order.  The receipt makes
    # identical deliveries idempotent; the row lock plus the transition guard
    # keeps two different, out-of-order deliveries from racing a terminal
    # lifecycle state backwards.
    order = await db.scalar(
        select(SaleOrder).where(SaleOrder.name == payload.order_reference).with_for_update()
    )
    if order is None:
        raise ResourceNotFoundError("SaleOrder", payload.order_reference)

    existing_picking = await _latest_picking(db, order)
    if not _can_apply_lifecycle_update(order, existing_picking, payload.new_status):
        logger.info(
            "Ignored stale Odoo order update: order=%s status=%s current_order_state=%s "
            "current_picking_state=%s event=%s",
            order.name,
            payload.new_status,
            order.state,
            existing_picking.state if existing_picking is not None else None,
            event_key,
        )
        return {
            "status": "stale",
            "event_key": event_key,
            "order_reference": order.name,
            "order_state": order.state,
            "picking_id": existing_picking.id if existing_picking is not None else None,
            "tracking_number": (
                existing_picking.courier_tracking_ref if existing_picking is not None else None
            ),
            "changed": False,
        }

    picking = await _get_or_create_picking(db, order, payload)
    previous_order_state = order.state
    previous_tracking_number = picking.courier_tracking_ref
    target_order_state = ORDER_STATE_BY_ODOO_STATUS[payload.new_status]
    target_picking_state = PICKING_STATE_BY_ODOO_STATUS[payload.new_status]

    # Odoo owns fulfillment status.  Do not route this through the storefront
    # state machine (which rightly enforces customer/admin transitions).
    order.state = target_order_state
    if payload.odoo_order_id is not None:
        order.odoo_order_id = payload.odoo_order_id
    picking.state = target_picking_state
    if payload.tracking_number:
        picking.courier_tracking_ref = payload.tracking_number
    if target_picking_state == "done":
        picking.completed_date = payload.timestamp
    await db.flush()

    changed = (
        previous_order_state != order.state
        or previous_tracking_number != picking.courier_tracking_ref
    )
    event_type = EVENT_CLASS_BY_ODOO_STATUS.get(payload.new_status)
    if changed and event_type is not None:
        await publish_domain_event(
            db,
            event_type(
                payload={
                    "order_id": order.id,
                    "order_number": order.name,
                    "state": order.state,
                    "odoo_status": payload.new_status,
                    "picking_id": picking.id,
                    "tracking_number": picking.courier_tracking_ref,
                    "carrier": payload.carrier,
                    "event_key": event_key,
                    "occurred_at": payload.timestamp.isoformat(),
                }
            ),
            source_context="odoo_webhook",
        )

    logger.info(
        "Applied Odoo order update: order=%s status=%s state=%s tracking=%s event=%s",
        order.name,
        payload.new_status,
        order.state,
        picking.courier_tracking_ref,
        event_key,
    )
    return {
        "status": "processed",
        "event_key": event_key,
        "order_reference": order.name,
        "order_state": order.state,
        "picking_id": picking.id,
        "tracking_number": picking.courier_tracking_ref,
        "changed": changed,
    }

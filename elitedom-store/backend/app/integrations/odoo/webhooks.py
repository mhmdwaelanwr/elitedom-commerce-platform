"""Signed Odoo ERP webhook handlers.

Odoo is authoritative for physical inventory and ERP fulfillment facts.  All
callbacks are HMAC authenticated, receipt-deduplicated, row-serialized, and
projected into the explicit Stage 6 lifecycle without trusting client state.
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
from app.modules.fulfillment.models import Shipment
from app.modules.fulfillment.service import (
    CANCELLED,
    CONFIRMED,
    DELIVERED,
    PAYMENT_PENDING,
    PROCESSING,
    SHIPPED,
    FulfillmentLifecycleService,
)
from app.modules.inventory.reservations import InventoryReservationService
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
FULFILLMENT_STATUS_BY_ODOO_STATUS = {
    "draft": PAYMENT_PENDING,
    "sent": CONFIRMED,
    "confirmed": CONFIRMED,
    "sale": CONFIRMED,
    "paid": CONFIRMED,
    "processing": PROCESSING,
    "invoiced": PROCESSING,
    "shipped": SHIPPED,
    "delivered": DELIVERED,
    "done": DELIVERED,
    "cancel": CANCELLED,
    "cancelled": CANCELLED,
    "canceled": CANCELLED,
}
FULFILLMENT_RANK = {
    PAYMENT_PENDING: 0,
    CONFIRMED: 1,
    PROCESSING: 2,
    SHIPPED: 3,
    DELIVERED: 4,
}
ODOO_CANCELLATION_STATUSES = {"cancel", "cancelled", "canceled"}


class _OdooWebhookPayload(BaseModel):
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


async def _shipment_for_picking(
    db: AsyncSession,
    order: SaleOrder,
    picking: StockPicking,
) -> Shipment:
    shipment = await db.scalar(
        select(Shipment)
        .where(
            Shipment.order_id == order.id,
            Shipment.external_reference == picking.name,
        )
        .order_by(Shipment.id.desc())
        .limit(1)
        .with_for_update()
    )
    if shipment is None:
        shipment = await db.scalar(
            select(Shipment)
            .where(Shipment.shipment_key == f"picking:{picking.id}")
            .with_for_update()
        )
    if shipment is None:
        shipment = Shipment(
            order_id=order.id,
            shipment_key=f"picking:{picking.id}",
            fulfillment_leg="dropship" if picking.picking_type == "dropship" else "local",
            status="pending",
            external_reference=picking.name,
        )
        db.add(shipment)
        await db.flush()
    return shipment


def _can_apply_fulfillment(current_status: str, new_odoo_status: str) -> bool:
    if current_status == CANCELLED:
        return False
    if new_odoo_status in ODOO_CANCELLATION_STATUSES:
        return current_status in {PAYMENT_PENDING, CONFIRMED, PROCESSING}
    target = FULFILLMENT_STATUS_BY_ODOO_STATUS[new_odoo_status]
    current_rank = FULFILLMENT_RANK.get(current_status)
    target_rank = FULFILLMENT_RANK.get(target)
    if current_rank is None or target_rank is None:
        return False
    return target_rank > current_rank


@router.post("/inventory")
async def odoo_inventory_webhook(
    body: VerifiedOdooBody,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
):
    """Apply an authenticated absolute Odoo stock snapshot reservation-safely."""
    payload = _parse_payload(body, InventoryWebhookPayload)
    event_key = _event_key(body, payload.event_id, idempotency_key)
    if not await _claim_delivery(
        db, body=body, event_key=event_key, event_type="inventory.stock.updated"
    ):
        logger.info("Ignoring duplicate Odoo inventory webhook: %s", event_key)
        return {"status": "duplicate", "event_key": event_key, "sku": payload.product_sku}

    product = await db.scalar(
        select(ProductTemplate)
        .where(ProductTemplate.sku == payload.product_sku)
        .with_for_update()
    )
    if product is None:
        raise ResourceNotFoundError("Product SKU", payload.product_sku)

    previous_quantity, new_available = await InventoryReservationService(
        db
    ).apply_authoritative_quantity(
        product=product,
        source_quantity=payload.new_quantity,
        source="odoo_webhook",
        occurred_at=payload.timestamp,
    )

    if previous_quantity != new_available:
        await publish_domain_event(
            db,
            InventoryUpdated(
                payload={
                    "product_id": product.id,
                    "sku": product.sku,
                    "previous_quantity": previous_quantity,
                    "source_on_hand_quantity": payload.new_quantity,
                    "new_quantity": new_available,
                    "warehouse_location": payload.warehouse_location,
                    "event_key": event_key,
                    "occurred_at": payload.timestamp.isoformat(),
                }
            ),
            source_context="odoo_webhook",
        )

    logger.info(
        "Applied Odoo inventory update: sku=%s source_on_hand=%s available=%s event=%s",
        product.sku,
        payload.new_quantity,
        new_available,
        event_key,
    )
    return {
        "status": "processed",
        "event_key": event_key,
        "sku": product.sku,
        "stock_qty": new_available,
        "source_on_hand_qty": payload.new_quantity,
        "changed": previous_quantity != new_available,
    }


@router.post("/order-status")
async def odoo_order_status_webhook(
    body: VerifiedOdooBody,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
):
    """Apply one trusted, forward-only Odoo fulfillment/tracking update."""
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

    order = await db.scalar(
        select(SaleOrder).where(SaleOrder.name == payload.order_reference).with_for_update()
    )
    if order is None:
        raise ResourceNotFoundError("SaleOrder", payload.order_reference)

    lifecycle_service = FulfillmentLifecycleService(db)
    lifecycle = await lifecycle_service.get(order.id, lock=True)
    if not _can_apply_fulfillment(lifecycle.status, payload.new_status):
        picking = await db.scalar(
            select(StockPicking)
            .where(StockPicking.sale_id == order.id)
            .order_by(StockPicking.id.desc())
            .limit(1)
        )
        logger.info(
            "Ignored stale Odoo order update: order=%s status=%s fulfillment=%s event=%s",
            order.name,
            payload.new_status,
            lifecycle.status,
            event_key,
        )
        return {
            "status": "stale",
            "event_key": event_key,
            "order_reference": order.name,
            "order_state": order.state,
            "picking_id": picking.id if picking is not None else None,
            "tracking_number": (
                picking.courier_tracking_ref if picking is not None else None
            ),
            "changed": False,
        }

    previous_order_state = order.state
    previous_fulfillment_status = lifecycle.status
    target_order_state = ORDER_STATE_BY_ODOO_STATUS[payload.new_status]
    target_fulfillment = FULFILLMENT_STATUS_BY_ODOO_STATUS[payload.new_status]
    picking = await _get_or_create_picking(db, order, payload)
    previous_picking_state = picking.state
    previous_tracking_number = picking.courier_tracking_ref

    if payload.new_status in ODOO_CANCELLATION_STATUSES:
        lifecycle, lifecycle_changed = await lifecycle_service.cancel(
            order.id,
            reason="odoo_cancelled",
            occurred_at=payload.timestamp,
        )
        released = await InventoryReservationService(db).release_order(order.id)
        if released or not order.stock_reservation_released:
            order.stock_reservation_released = True
        picking.state = "cancel"
    else:
        lifecycle, lifecycle_changed = await lifecycle_service.force_forward_from_integration(
            order.id,
            target_fulfillment,
            occurred_at=payload.timestamp,
        )
        picking.state = PICKING_STATE_BY_ODOO_STATUS[payload.new_status]

    order.state = target_order_state
    if payload.odoo_order_id is not None:
        order.odoo_order_id = payload.odoo_order_id
    if payload.tracking_number:
        picking.courier_tracking_ref = payload.tracking_number
    if picking.state == "done":
        picking.completed_date = payload.timestamp

    shipment = await _shipment_for_picking(db, order, picking)
    shipment.carrier = payload.carrier or shipment.carrier
    shipment.tracking_number = payload.tracking_number or shipment.tracking_number
    shipment.external_reference = picking.name
    if target_fulfillment == SHIPPED:
        if shipment.status != "shipped":
            shipment.status = "shipped"
            shipment.shipped_at = shipment.shipped_at or payload.timestamp
        if previous_picking_state != "done" and picking.picking_type != "dropship":
            await InventoryReservationService(db).mark_order_consumed(
                order.id,
                occurred_at=payload.timestamp,
            )
    elif target_fulfillment == DELIVERED:
        shipment.status = "delivered"
        shipment.shipped_at = shipment.shipped_at or payload.timestamp
        shipment.delivered_at = shipment.delivered_at or payload.timestamp
    elif target_fulfillment == CANCELLED:
        if shipment.status not in {"shipped", "delivered"}:
            shipment.status = "cancelled"
    await db.flush()

    changed = (
        previous_order_state != order.state
        or previous_fulfillment_status != lifecycle.status
        or previous_picking_state != picking.state
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
                    "fulfillment_status": lifecycle.status,
                    "odoo_status": payload.new_status,
                    "picking_id": picking.id,
                    "shipment_id": shipment.id,
                    "tracking_number": picking.courier_tracking_ref,
                    "carrier": payload.carrier,
                    "event_key": event_key,
                    "occurred_at": payload.timestamp.isoformat(),
                }
            ),
            source_context="odoo_webhook",
        )

    logger.info(
        "Applied Odoo order update: order=%s status=%s state=%s fulfillment=%s "
        "tracking=%s event=%s",
        order.name,
        payload.new_status,
        order.state,
        lifecycle.status,
        picking.courier_tracking_ref,
        event_key,
    )
    return {
        "status": "processed",
        "event_key": event_key,
        "order_reference": order.name,
        "order_state": order.state,
        "fulfillment_status": lifecycle.status,
        "picking_id": picking.id,
        "shipment_id": shipment.id,
        "tracking_number": picking.courier_tracking_ref,
        "carrier": shipment.carrier,
        "changed": changed or lifecycle_changed,
    }

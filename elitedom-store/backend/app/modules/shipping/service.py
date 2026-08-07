"""Production-grade local and dropship shipment persistence for Stage 6.

The legacy ``StockPicking`` mirror is retained for Odoo/API compatibility while
``Shipment`` and ``OrderFulfillment`` carry the explicit customer lifecycle.
"""

from datetime import UTC, datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    ProductTemplate,
    PurchaseOrder,
    SaleOrder,
    SaleOrderLine,
    StockLot,
    StockPicking,
)
from app.modules.fulfillment.models import InventoryReservation, Shipment
from app.modules.fulfillment.service import (
    CONFIRMED,
    DELIVERED,
    SHIPPED,
    FulfillmentLifecycleService,
)
from app.modules.inventory.reservations import InventoryReservationService
from app.shared.events import OrderDelivered, OrderShipped, ShipmentCreated
from app.shared.exceptions import (
    InsufficientPermissionsError,
    InvalidOrderStateTransition,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, PaymentMethod, PickingState, PickingType


class ShipmentTrackingItem(BaseModel):
    id: int
    fulfillment_leg: str
    status: str
    carrier: str | None = None
    tracking_number: str | None = None
    external_reference: str | None = None
    scheduled_at: datetime | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None


class ShippingTrackingResponse(BaseModel):
    order_id: int
    order_number: str
    tracking_number: str | None = None
    status: str
    fulfillment_status: str
    carrier: str | None = None
    picking_reference: str | None = None
    picking_state: str | None = None
    scheduled_date: datetime | None = None
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None
    shipments: list[ShipmentTrackingItem] = []


class DispatchOrderRequest(BaseModel):
    """Warehouse-provided local dispatch facts for one customer order."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    tracking_number: str = Field(
        ...,
        min_length=3,
        max_length=128,
        validation_alias=AliasChoices("tracking_number", "courier_tracking_ref"),
    )
    carrier: str | None = Field(default=None, min_length=2, max_length=128)
    reference: str | None = Field(
        default=None,
        min_length=3,
        max_length=64,
        validation_alias=AliasChoices("reference", "picking_reference", "picking_name"),
    )
    scheduled_date: datetime | None = None

    @field_validator("tracking_number", "carrier", "reference")
    @classmethod
    def strip_non_empty_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value must not be blank.")
        return cleaned


class DispatchOrderResponse(BaseModel):
    order_id: int
    order_number: str
    order_state: str
    fulfillment_status: str
    picking_id: int
    picking_reference: str
    picking_type: str
    picking_state: str
    tracking_number: str
    carrier: str | None = None
    dispatched_at: datetime


class SupplierShipmentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    purchase_order_number: str = Field(..., min_length=3, max_length=64)
    status: Literal["shipped", "delivered", "exception"]
    tracking_number: str | None = Field(default=None, min_length=3, max_length=128)
    carrier: str | None = Field(default=None, min_length=2, max_length=128)
    occurred_at: datetime | None = None

    @field_validator("purchase_order_number", "tracking_number", "carrier")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value must not be blank.")
        return cleaned


class ShippingService:
    """Persist fulfilment state while applying ownership and state rules."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tracking(
        self,
        order_id: int,
        requester_id: int,
        *,
        include_all: bool,
    ) -> ShippingTrackingResponse:
        """Return tracking only to the purchaser or a system administrator."""
        order = await self._get_order(order_id)
        if not include_all and order.partner_id != requester_id:
            raise InsufficientPermissionsError()

        lifecycle = await FulfillmentLifecycleService(self.db).get(order.id)
        shipments = await self._shipments(order.id)
        latest_shipment = shipments[-1] if shipments else None
        picking = self._latest_delivery_picking(order)

        if latest_shipment is None and picking is None:
            return ShippingTrackingResponse(
                order_id=order.id,
                order_number=order.name,
                status="pending",
                fulfillment_status=lifecycle.status,
            )

        tracking_number = (
            latest_shipment.tracking_number
            if latest_shipment is not None
            else picking.courier_tracking_ref if picking is not None else None
        )
        carrier = latest_shipment.carrier if latest_shipment is not None else None
        delivered_at = (
            latest_shipment.delivered_at if latest_shipment is not None else None
        )
        if lifecycle.status == DELIVERED:
            public_status = "delivered"
        elif latest_shipment is not None and latest_shipment.status == "shipped":
            public_status = "dispatched"
        elif picking is not None and picking.state == PickingState.DONE.value:
            public_status = "dispatched"
        else:
            public_status = latest_shipment.status if latest_shipment is not None else picking.state

        return ShippingTrackingResponse(
            order_id=order.id,
            order_number=order.name,
            tracking_number=tracking_number,
            status=public_status,
            fulfillment_status=lifecycle.status,
            carrier=carrier,
            picking_reference=picking.name if picking is not None else None,
            picking_state=picking.state if picking is not None else None,
            scheduled_date=(
                latest_shipment.scheduled_at
                if latest_shipment is not None and latest_shipment.scheduled_at is not None
                else picking.scheduled_date if picking is not None else None
            ),
            dispatched_at=(
                latest_shipment.shipped_at
                if latest_shipment is not None and latest_shipment.shipped_at is not None
                else picking.completed_date if picking is not None else None
            ),
            delivered_at=delivered_at,
            shipments=[self._shipment_item(shipment) for shipment in shipments],
        )

    async def dispatch_order(
        self, order_id: int, request: DispatchOrderRequest
    ) -> DispatchOrderResponse:
        """Create/update a local delivery leg and mark it shipped idempotently."""
        order = await self._get_order(order_id)
        is_vetted_cod_order = (
            order.state == OrderState.SENT.value and order.payment_method == PaymentMethod.COD.value
        )
        if (
            order.state not in {OrderState.SALE.value, OrderState.DONE.value}
            and not is_vetted_cod_order
        ):
            raise InvalidOrderStateTransition(order.state, OrderState.DONE.value)

        lifecycle_service = FulfillmentLifecycleService(self.db)
        lifecycle = await lifecycle_service.get(order.id, lock=True)
        if lifecycle.status == "payment_pending" and is_vetted_cod_order:
            lifecycle = await lifecycle_service.transition(order.id, CONFIRMED)

        await self._assign_available_serial_lots(order)
        picking = self._latest_delivery_picking(order)
        created = picking is None
        reference = request.reference or self._default_picking_reference(order)
        local_required = await self._has_local_reservations(order.id)
        fulfillment_leg = "local" if local_required or not order.is_dropship else "dropship"

        if picking is None:
            await self._ensure_reference_is_available(reference)
            picking = StockPicking(
                name=reference,
                sale_id=order.id,
                picking_type=(
                    PickingType.OUTGOING.value
                    if fulfillment_leg == "local"
                    else PickingType.DROPSHIP.value
                ),
                state=PickingState.DRAFT.value,
            )
            self.db.add(picking)
            await self.db.flush()
        elif request.reference and request.reference != picking.name:
            await self._ensure_reference_is_available(reference, exclude_picking_id=picking.id)
            picking.name = reference

        was_dispatched = picking.state == PickingState.DONE.value
        dispatched_at = picking.completed_date or datetime.now(UTC)
        picking.courier_tracking_ref = request.tracking_number
        picking.state = PickingState.DONE.value
        picking.completed_date = dispatched_at
        if request.scheduled_date is not None:
            picking.scheduled_date = request.scheduled_date

        # Keep the legacy state change because existing Odoo/API consumers use
        # it.  The explicit fulfillment record remains ``shipped`` until a
        # separate delivery confirmation arrives.
        if order.state in {OrderState.SALE.value, OrderState.SENT.value}:
            order.state = OrderState.DONE.value

        shipment_key = f"picking:{picking.id}"
        shipment = await self.db.scalar(
            select(Shipment).where(Shipment.shipment_key == shipment_key).with_for_update()
        )
        if shipment is None:
            shipment = Shipment(
                order_id=order.id,
                shipment_key=shipment_key,
                fulfillment_leg=fulfillment_leg,
                status="pending",
            )
            self.db.add(shipment)
        shipment.status = "shipped"
        shipment.carrier = request.carrier
        shipment.tracking_number = request.tracking_number
        shipment.external_reference = picking.name
        shipment.scheduled_at = request.scheduled_date or picking.scheduled_date
        shipment.shipped_at = shipment.shipped_at or dispatched_at

        if fulfillment_leg == "local" and not was_dispatched:
            await InventoryReservationService(self.db).mark_order_consumed(order.id)

        await self.db.flush()
        if await self._all_required_shipments_in(order.id, {"shipped", "delivered"}):
            lifecycle, _ = await lifecycle_service.force_forward_from_integration(
                order.id,
                SHIPPED,
                occurred_at=dispatched_at,
            )

        if created:
            await publish_domain_event(
                self.db,
                ShipmentCreated(
                    payload={
                        "order_id": order.id,
                        "order_number": order.name,
                        "picking_id": picking.id,
                        "picking_reference": picking.name,
                        "shipment_id": shipment.id,
                        "fulfillment_leg": fulfillment_leg,
                    }
                ),
            )
        if not was_dispatched:
            await publish_domain_event(
                self.db,
                OrderShipped(
                    payload={
                        "order_id": order.id,
                        "order_number": order.name,
                        "picking_id": picking.id,
                        "shipment_id": shipment.id,
                        "tracking_number": shipment.tracking_number,
                        "carrier": shipment.carrier,
                    }
                ),
            )

        return DispatchOrderResponse(
            order_id=order.id,
            order_number=order.name,
            order_state=order.state,
            fulfillment_status=lifecycle.status,
            picking_id=picking.id,
            picking_reference=picking.name,
            picking_type=picking.picking_type,
            picking_state=picking.state,
            tracking_number=shipment.tracking_number or request.tracking_number,
            carrier=shipment.carrier,
            dispatched_at=shipment.shipped_at or dispatched_at,
        )

    async def mark_delivered(self, order_id: int) -> ShippingTrackingResponse:
        """Record a separate delivery confirmation for the latest shipped leg."""
        order = await self._get_order(order_id)
        shipments = await self._shipments(order.id, lock=True)
        shipped = [shipment for shipment in shipments if shipment.status == "shipped"]
        if not shipped:
            if any(shipment.status == "delivered" for shipment in shipments):
                lifecycle = await FulfillmentLifecycleService(self.db).get(order.id)
                return await self.get_tracking(order.id, order.partner_id, include_all=True)
            raise ResourceConflictError("No dispatched shipment is available to mark delivered.")

        shipment = shipped[-1]
        delivered_at = datetime.now(UTC)
        shipment.status = "delivered"
        shipment.delivered_at = shipment.delivered_at or delivered_at
        await self.db.flush()

        lifecycle_service = FulfillmentLifecycleService(self.db)
        lifecycle = await lifecycle_service.get(order.id, lock=True)
        if await self._all_required_shipments_in(order.id, {"delivered"}):
            lifecycle, changed = await lifecycle_service.force_forward_from_integration(
                order.id,
                DELIVERED,
                occurred_at=delivered_at,
            )
            if changed:
                await publish_domain_event(
                    self.db,
                    OrderDelivered(
                        payload={
                            "order_id": order.id,
                            "order_number": order.name,
                            "shipment_id": shipment.id,
                            "tracking_number": shipment.tracking_number,
                        }
                    ),
                )
        return await self.get_tracking(order.id, order.partner_id, include_all=True)

    async def update_supplier_shipment(
        self,
        order_id: int,
        request: SupplierShipmentRequest,
    ) -> ShippingTrackingResponse:
        """Persist verified operations facts for one dropship supplier PO leg."""
        order = await self._get_order(order_id)
        purchase_order = await self.db.scalar(
            select(PurchaseOrder)
            .where(
                PurchaseOrder.sale_order_id == order.id,
                PurchaseOrder.po_number == request.purchase_order_number,
            )
            .with_for_update()
        )
        if purchase_order is None:
            raise ResourceNotFoundError("PurchaseOrder", request.purchase_order_number)

        shipment_key = f"dropship-po:{purchase_order.id}"
        shipment = await self.db.scalar(
            select(Shipment).where(Shipment.shipment_key == shipment_key).with_for_update()
        )
        if shipment is None:
            shipment = Shipment(
                order_id=order.id,
                supplier_po_id=purchase_order.id,
                shipment_key=shipment_key,
                fulfillment_leg="dropship",
                status="pending",
                external_reference=purchase_order.po_number,
            )
            self.db.add(shipment)

        now = request.occurred_at or datetime.now(UTC)
        if request.status in {"shipped", "delivered"} and not request.tracking_number:
            raise ResourceConflictError("A supplier shipment requires a tracking number.")
        if shipment.status == "delivered" and request.status != "delivered":
            return await self.get_tracking(order.id, order.partner_id, include_all=True)

        shipment.status = request.status
        shipment.tracking_number = request.tracking_number or shipment.tracking_number
        shipment.carrier = request.carrier or shipment.carrier
        if request.status == "shipped":
            shipment.shipped_at = shipment.shipped_at or now
        elif request.status == "delivered":
            shipment.shipped_at = shipment.shipped_at or now
            shipment.delivered_at = shipment.delivered_at or now
        await self.db.flush()

        lifecycle_service = FulfillmentLifecycleService(self.db)
        if await self._all_required_shipments_in(order.id, {"delivered"}):
            await lifecycle_service.force_forward_from_integration(
                order.id, DELIVERED, occurred_at=now
            )
        elif await self._all_required_shipments_in(order.id, {"shipped", "delivered"}):
            await lifecycle_service.force_forward_from_integration(
                order.id, SHIPPED, occurred_at=now
            )
        return await self.get_tracking(order.id, order.partner_id, include_all=True)

    async def _get_order(self, order_id: int) -> SaleOrder:
        result = await self.db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.pickings))
            .execution_options(populate_existing=True)
            .where(SaleOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)
        return order

    async def _shipments(self, order_id: int, *, lock: bool = False) -> list[Shipment]:
        query = select(Shipment).where(Shipment.order_id == order_id).order_by(Shipment.id)
        if lock:
            query = query.with_for_update()
        return list((await self.db.execute(query)).scalars().all())

    async def _has_local_reservations(self, order_id: int) -> bool:
        count = await self.db.scalar(
            select(func.count(InventoryReservation.id)).where(
                InventoryReservation.order_id == order_id
            )
        )
        return bool(count)

    async def _all_required_shipments_in(self, order_id: int, statuses: set[str]) -> bool:
        shipments = await self._shipments(order_id)
        local_required = await self._has_local_reservations(order_id)
        if local_required and not any(
            shipment.fulfillment_leg == "local" and shipment.status in statuses
            for shipment in shipments
        ):
            return False

        purchase_orders = (
            (
                await self.db.execute(
                    select(PurchaseOrder).where(
                        PurchaseOrder.sale_order_id == order_id,
                        PurchaseOrder.status != "cancelled",
                    )
                )
            )
            .scalars()
            .all()
        )
        for purchase_order in purchase_orders:
            if not any(
                shipment.supplier_po_id == purchase_order.id and shipment.status in statuses
                for shipment in shipments
            ):
                return False

        if not local_required and not purchase_orders:
            return any(shipment.status in statuses for shipment in shipments)
        return True

    async def _ensure_reference_is_available(
        self, reference: str, *, exclude_picking_id: int | None = None
    ) -> None:
        query = select(StockPicking.id).where(StockPicking.name == reference)
        if exclude_picking_id is not None:
            query = query.where(StockPicking.id != exclude_picking_id)
        if (await self.db.execute(query)).scalar_one_or_none() is not None:
            raise ResourceConflictError("A stock picking with this reference already exists.")

    async def _assign_available_serial_lots(self, order: SaleOrder) -> None:
        """Bind recorded local serials to a delivery before it can be dispatched."""
        rows = (
            await self.db.execute(
                select(SaleOrderLine, ProductTemplate)
                .join(ProductTemplate, SaleOrderLine.product_id == ProductTemplate.id)
                .where(SaleOrderLine.order_id == order.id)
            )
        ).all()

        quantities_by_product: dict[int, int] = {}
        serial_products: dict[int, ProductTemplate] = {}
        for line, product in rows:
            if product.tracking != "serial" or product.is_dropship_enabled:
                continue
            quantities_by_product[line.product_id] = (
                quantities_by_product.get(line.product_id, 0) + line.quantity
            )
            serial_products[line.product_id] = product

        if not serial_products:
            return

        existing_lots = (
            (
                await self.db.execute(
                    select(StockLot).where(
                        StockLot.sale_order_id == order.id,
                        StockLot.product_id.in_(list(serial_products)),
                    )
                )
            )
            .scalars()
            .all()
        )
        already_assigned_by_product: dict[int, int] = {}
        for lot in existing_lots:
            already_assigned_by_product[lot.product_id] = (
                already_assigned_by_product.get(lot.product_id, 0) + 1
            )

        lots_to_assign: list[StockLot] = []
        for product_id, quantity in quantities_by_product.items():
            needed = quantity - already_assigned_by_product.get(product_id, 0)
            if needed <= 0:
                continue

            available_lots = (
                (
                    await self.db.execute(
                        select(StockLot)
                        .where(
                            StockLot.product_id == product_id,
                            StockLot.sale_order_id.is_(None),
                        )
                        .order_by(StockLot.id)
                        .limit(needed)
                        .with_for_update()
                    )
                )
                .scalars()
                .all()
            )
            if len(available_lots) < needed:
                product = serial_products[product_id]
                raise ResourceConflictError(
                    "Dispatch requires "
                    f"{needed} unassigned serial number(s) for SKU '{product.sku}'."
                )
            lots_to_assign.extend(available_lots)

        for lot in lots_to_assign:
            lot.sale_order_id = order.id

    @staticmethod
    def _latest_delivery_picking(order: SaleOrder) -> StockPicking | None:
        delivery_pickings = [
            picking
            for picking in order.pickings
            if picking.picking_type in {PickingType.OUTGOING.value, PickingType.DROPSHIP.value}
        ]
        if not delivery_pickings:
            return None
        return max(delivery_pickings, key=lambda picking: picking.id)

    @staticmethod
    def _default_picking_reference(order: SaleOrder) -> str:
        return f"DO-{order.name}"[:64]

    @staticmethod
    def _shipment_item(shipment: Shipment) -> ShipmentTrackingItem:
        return ShipmentTrackingItem(
            id=shipment.id,
            fulfillment_leg=shipment.fulfillment_leg,
            status=shipment.status,
            carrier=shipment.carrier,
            tracking_number=shipment.tracking_number,
            external_reference=shipment.external_reference,
            scheduled_at=shipment.scheduled_at,
            shipped_at=shipment.shipped_at,
            delivered_at=shipment.delivered_at,
        )

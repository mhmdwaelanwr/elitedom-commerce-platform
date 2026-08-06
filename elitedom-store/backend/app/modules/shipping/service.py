"""Local order fulfilment and tracking persistence.

This module deliberately records only the delivery facts available in the
application database.  Carrier label generation, courier status polling, and
Odoo synchronisation remain integration responsibilities rather than being
simulated by this API.
"""

from datetime import UTC, datetime

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductTemplate, SaleOrder, SaleOrderLine, StockLot, StockPicking
from app.shared.events import OrderShipped, ShipmentCreated
from app.shared.exceptions import (
    InsufficientPermissionsError,
    InvalidOrderStateTransition,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, PaymentMethod, PickingState, PickingType


class ShippingTrackingResponse(BaseModel):
    order_id: int
    order_number: str
    tracking_number: str | None = None
    status: str
    picking_reference: str | None = None
    picking_state: str | None = None
    scheduled_date: datetime | None = None
    dispatched_at: datetime | None = None


class DispatchOrderRequest(BaseModel):
    """Warehouse-provided local dispatch facts for one customer order."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    tracking_number: str = Field(
        ...,
        min_length=3,
        max_length=128,
        validation_alias=AliasChoices("tracking_number", "courier_tracking_ref"),
    )
    reference: str | None = Field(
        default=None,
        min_length=3,
        max_length=64,
        validation_alias=AliasChoices("reference", "picking_reference", "picking_name"),
    )
    scheduled_date: datetime | None = None

    @field_validator("tracking_number", "reference")
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
    picking_id: int
    picking_reference: str
    picking_type: str
    picking_state: str
    tracking_number: str
    dispatched_at: datetime


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

        picking = self._latest_delivery_picking(order)
        if picking is None:
            return ShippingTrackingResponse(
                order_id=order.id,
                order_number=order.name,
                status="pending",
            )

        return ShippingTrackingResponse(
            order_id=order.id,
            order_number=order.name,
            tracking_number=picking.courier_tracking_ref,
            status=("dispatched" if picking.state == PickingState.DONE.value else picking.state),
            picking_reference=picking.name,
            picking_state=picking.state,
            scheduled_date=picking.scheduled_date,
            dispatched_at=picking.completed_date,
        )

    async def dispatch_order(
        self, order_id: int, request: DispatchOrderRequest
    ) -> DispatchOrderResponse:
        """Create or update the order's delivery picking and mark it dispatched."""
        order = await self._get_order(order_id)
        is_vetted_cod_order = (
            order.state == OrderState.SENT.value and order.payment_method == PaymentMethod.COD.value
        )
        if (
            order.state not in {OrderState.SALE.value, OrderState.DONE.value}
            and not is_vetted_cod_order
        ):
            raise InvalidOrderStateTransition(order.state, OrderState.DONE.value)

        await self._assign_available_serial_lots(order)
        picking = self._latest_delivery_picking(order)
        created = picking is None
        reference = request.reference or self._default_picking_reference(order)

        if picking is None:
            await self._ensure_reference_is_available(reference)
            picking = StockPicking(
                name=reference,
                sale_id=order.id,
                picking_type=(
                    PickingType.DROPSHIP.value if order.is_dropship else PickingType.OUTGOING.value
                ),
                state=PickingState.DRAFT.value,
            )
            self.db.add(picking)
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

        # The available order state model represents a shipment-complete order
        # as ``done``.  A second dispatch request is idempotent and can correct
        # the stored tracking/reference without attempting a new transition.
        if order.state in {OrderState.SALE.value, OrderState.SENT.value}:
            order.state = OrderState.DONE.value

        await self.db.flush()

        if created:
            await publish_domain_event(
                self.db,
                ShipmentCreated(
                    payload={
                        "order_id": order.id,
                        "order_number": order.name,
                        "picking_id": picking.id,
                        "picking_reference": picking.name,
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
                        "tracking_number": picking.courier_tracking_ref,
                    }
                ),
            )

        return DispatchOrderResponse(
            order_id=order.id,
            order_number=order.name,
            order_state=order.state,
            picking_id=picking.id,
            picking_reference=picking.name,
            picking_type=picking.picking_type,
            picking_state=picking.state,
            tracking_number=picking.courier_tracking_ref,
            dispatched_at=picking.completed_date,
        )

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

    async def _ensure_reference_is_available(
        self, reference: str, *, exclude_picking_id: int | None = None
    ) -> None:
        query = select(StockPicking.id).where(StockPicking.name == reference)
        if exclude_picking_id is not None:
            query = query.where(StockPicking.id != exclude_picking_id)
        if (await self.db.execute(query)).scalar_one_or_none() is not None:
            raise ResourceConflictError("A stock picking with this reference already exists.")

    async def _assign_available_serial_lots(self, order: SaleOrder) -> None:
        """Bind recorded local serials to a delivery before it can be dispatched.

        The schema has no separate stock-move or scan record, so ``StockLot``
        is the authoritative local binding for an order.  Lots are selected
        under a row lock and no object is mutated until every required product
        has enough recorded, unassigned serial numbers.
        """
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

"""Supplier master data, purchasing, and safe local goods receipt workflows."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductTemplate, PurchaseOrder, SaleOrder, Supplier
from app.modules.suppliers.schemas import (
    PurchaseOrderCreateRequest,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdateRequest,
    SupplierCreateRequest,
    SupplierListResponse,
    SupplierPerformanceResponse,
    SupplierResponse,
    SupplierUpdateRequest,
)
from app.shared.events import InventoryUpdated
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event

MONEY_QUANTUM = Decimal("0.01")
OPEN_PURCHASE_ORDER_STATUSES = {"draft", "sent", "partial"}
PURCHASE_ORDER_TRANSITIONS = {
    "draft": {"sent", "cancelled"},
    "sent": {"partial", "received", "cancelled"},
    "partial": {"received", "cancelled"},
    "received": set(),
    "cancelled": set(),
}


class SupplierService:
    """Own supplier/Purchase Order business rules rather than raw router CRUD."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_suppliers(
        self, *, page: int, limit: int, include_inactive: bool
    ) -> SupplierListResponse:
        filters = [] if include_inactive else [Supplier.is_active.is_(True)]
        count_query = select(func.count()).select_from(Supplier)
        if filters:
            count_query = count_query.where(*filters)
        total_count = (await self.db.execute(count_query)).scalar_one()
        query = (
            select(Supplier)
            .where(*filters)
            .order_by(Supplier.name.asc(), Supplier.id.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        suppliers = (await self.db.execute(query)).scalars().all()
        return SupplierListResponse(
            suppliers=[SupplierResponse.model_validate(supplier) for supplier in suppliers],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def get_supplier(self, supplier_id: int) -> SupplierResponse:
        return SupplierResponse.model_validate(await self._supplier(supplier_id))

    async def create_supplier(self, request: SupplierCreateRequest) -> SupplierResponse:
        values = request.model_dump(exclude_none=True)
        values["email"] = str(request.email).lower()
        supplier = Supplier(
            **values,
        )
        self.db.add(supplier)
        await self.db.flush()
        await self.db.refresh(supplier)
        return SupplierResponse.model_validate(supplier)

    async def update_supplier(
        self, supplier_id: int, request: SupplierUpdateRequest
    ) -> SupplierResponse:
        supplier = await self._supplier(supplier_id, lock=True)
        updates = request.model_dump(exclude_unset=True)
        if "email" in updates and updates["email"] is not None:
            updates["email"] = str(updates["email"]).lower()
        for field, value in updates.items():
            setattr(supplier, field, value)
        await self.db.flush()
        await self.db.refresh(supplier)
        return SupplierResponse.model_validate(supplier)

    async def supplier_performance(self, supplier_id: int) -> SupplierPerformanceResponse:
        supplier = await self._supplier(supplier_id)
        purchase_orders = (
            (
                await self.db.execute(
                    select(PurchaseOrder).where(PurchaseOrder.supplier_id == supplier.id)
                )
            )
            .scalars()
            .all()
        )
        received = [order for order in purchase_orders if order.status == "received"]
        on_time = [
            order
            for order in received
            if order.actual_delivery_date is not None
            and (
                order.expected_delivery_date is None
                or order.actual_delivery_date <= order.expected_delivery_date
            )
        ]
        delivery_days = [
            Decimal((order.actual_delivery_date - order.created_at.date()).days)
            for order in received
            if order.actual_delivery_date is not None
        ]
        average_delivery_days = (
            self._money(sum(delivery_days) / len(delivery_days)) if delivery_days else None
        )
        on_time_rate = self._percentage(len(on_time), len(received)) if received else None
        return SupplierPerformanceResponse(
            supplier=SupplierResponse.model_validate(supplier),
            total_purchase_orders=len(purchase_orders),
            received_purchase_orders=len(received),
            open_purchase_orders=sum(
                order.status in OPEN_PURCHASE_ORDER_STATUSES for order in purchase_orders
            ),
            on_time_deliveries=len(on_time),
            on_time_delivery_rate_percent=on_time_rate,
            average_delivery_days=average_delivery_days,
            defect_rate_percent=supplier.defect_rate_percent,
        )

    async def list_purchase_orders(
        self,
        *,
        page: int,
        limit: int,
        supplier_id: int | None,
        status: str | None,
    ) -> PurchaseOrderListResponse:
        filters = []
        if supplier_id is not None:
            filters.append(PurchaseOrder.supplier_id == supplier_id)
        if status is not None:
            filters.append(PurchaseOrder.status == status)
        count_query = select(func.count()).select_from(PurchaseOrder)
        if filters:
            count_query = count_query.where(*filters)
        total_count = (await self.db.execute(count_query)).scalar_one()
        query = (
            select(PurchaseOrder)
            .where(*filters)
            .order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        orders = (await self.db.execute(query)).scalars().all()
        return PurchaseOrderListResponse(
            purchase_orders=[PurchaseOrderResponse.model_validate(order) for order in orders],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def create_purchase_order(
        self, request: PurchaseOrderCreateRequest
    ) -> PurchaseOrderResponse:
        supplier = await self._supplier(request.supplier_id)
        if not supplier.is_active:
            raise ResourceConflictError("Inactive suppliers cannot receive purchase orders.")
        if request.sale_order_id is not None:
            await self._sale_order(request.sale_order_id)

        product_ids = [item.product_id for item in request.items]
        products = await self._products(product_ids)
        serialized_items: list[dict[str, object]] = []
        total = Decimal("0.00")
        for item in request.items:
            product = products[item.product_id]
            unit_cost = self._money(item.unit_cost or product.base_cost_usd)
            line_total = self._money(unit_cost * item.quantity)
            total += line_total
            serialized_items.append(
                {
                    "product_id": product.id,
                    "sku": product.sku,
                    "name": product.name,
                    "quantity": item.quantity,
                    "unit_cost": str(unit_cost),
                    "line_total": str(line_total),
                }
            )

        expected_delivery_date = request.expected_delivery_date or date.fromordinal(
            date.today().toordinal() + supplier.lead_time_days
        )
        purchase_order = PurchaseOrder(
            po_number=f"PO-{date.today():%Y%m%d}-{uuid4().hex[:8].upper()}",
            supplier_id=supplier.id,
            sale_order_id=request.sale_order_id,
            status="draft",
            items_payload={"schema_version": 1, "items": serialized_items},
            total_amount=self._money(total),
            currency=request.currency,
            expected_delivery_date=expected_delivery_date,
        )
        self.db.add(purchase_order)
        await self.db.flush()
        await self.db.refresh(purchase_order)
        return PurchaseOrderResponse.model_validate(purchase_order)

    async def update_purchase_order(
        self, po_number: str, request: PurchaseOrderUpdateRequest
    ) -> PurchaseOrderResponse:
        order = await self._purchase_order(po_number, lock=True)
        if request.status not in PURCHASE_ORDER_TRANSITIONS.get(order.status, set()):
            raise ResourceConflictError(
                f"Cannot transition purchase order '{order.po_number}' from "
                f"'{order.status}' to '{request.status}'."
            )

        order.status = request.status
        if request.status == "received":
            order.actual_delivery_date = request.actual_delivery_date or date.today()
            # A system-generated dropship PO represents supplier-to-customer
            # fulfilment.  Receiving/closing that PO must never create local
            # warehouse stock.  Standard procurement POs keep the existing
            # goods-receipt behaviour.
            is_dropship_fulfillment = bool(
                order.fulfillment_key and order.fulfillment_key.startswith("dropship:")
            )
            if not is_dropship_fulfillment:
                products = await self._products(
                    [int(item["product_id"]) for item in self._purchase_order_items(order)],
                    lock=True,
                    active_only=False,
                )
                for item in self._purchase_order_items(order):
                    product = products[int(item["product_id"])]
                    quantity = int(item["quantity"])
                    previous_stock_qty = product.stock_qty
                    product.stock_qty += quantity
                    await publish_domain_event(
                        self.db,
                        InventoryUpdated(
                            payload={
                                "product_id": product.id,
                                "sku": product.sku,
                                "previous_quantity": previous_stock_qty,
                                "quantity_delta": quantity,
                                "new_quantity": product.stock_qty,
                                "purchase_order_number": order.po_number,
                                "reason": f"Purchase order {order.po_number} received",
                            }
                        ),
                        source_context="supplier_receipt",
                    )
        elif request.actual_delivery_date is not None:
            raise ResourceConflictError(
                "actual_delivery_date can only be set when a purchase order is received."
            )

        await self.db.flush()
        await self.db.refresh(order)
        return PurchaseOrderResponse.model_validate(order)

    async def _supplier(self, supplier_id: int, *, lock: bool = False) -> Supplier:
        query = select(Supplier).where(Supplier.id == supplier_id)
        if lock:
            query = query.with_for_update()
        supplier = (await self.db.execute(query)).scalar_one_or_none()
        if supplier is None:
            raise ResourceNotFoundError("Supplier", supplier_id)
        return supplier

    async def _sale_order(self, sale_order_id: int) -> SaleOrder:
        order = (
            await self.db.execute(select(SaleOrder).where(SaleOrder.id == sale_order_id))
        ).scalar_one_or_none()
        if order is None:
            raise ResourceNotFoundError("SaleOrder", sale_order_id)
        return order

    async def _products(
        self, product_ids: list[int], *, lock: bool = False, active_only: bool = True
    ) -> dict[int, ProductTemplate]:
        query = select(ProductTemplate).where(ProductTemplate.id.in_(product_ids))
        if active_only:
            query = query.where(ProductTemplate.is_active.is_(True))
        if lock:
            query = query.with_for_update()
        products = {product.id: product for product in (await self.db.execute(query)).scalars()}
        missing = sorted(set(product_ids).difference(products))
        if missing:
            raise ResourceNotFoundError("Product", ", ".join(map(str, missing)))
        return products

    async def _purchase_order(self, po_number: str, *, lock: bool = False) -> PurchaseOrder:
        query = select(PurchaseOrder).where(PurchaseOrder.po_number == po_number.strip())
        if lock:
            query = query.with_for_update()
        purchase_order = (await self.db.execute(query)).scalar_one_or_none()
        if purchase_order is None:
            raise ResourceNotFoundError("PurchaseOrder", po_number)
        return purchase_order

    @staticmethod
    def _purchase_order_items(order: PurchaseOrder) -> list[dict]:
        items = order.items_payload.get("items") if isinstance(order.items_payload, dict) else None
        if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
            raise ResourceConflictError(
                "Purchase order items are malformed and cannot be received."
            )
        return items

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

    @staticmethod
    def _percentage(numerator: int, denominator: int) -> Decimal:
        return (Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(
            MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )

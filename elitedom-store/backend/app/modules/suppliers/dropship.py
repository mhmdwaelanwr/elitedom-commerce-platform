"""Verified supplier catalogue and local-only dropship fulfilment orchestration.

This module deliberately stops at the durable outbox boundary.  It creates a
local Purchase Order only after a payment has been confirmed, but it does not
send customer data or make a supplier API/email call.  A future, separately
authorized provider adapter can consume ``DropshipFulfillmentRequested``.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductSupplier, ProductTemplate, PurchaseOrder, SaleOrder, Supplier
from app.modules.suppliers.schemas import (
    ProductSupplierListResponse,
    ProductSupplierResponse,
    ProductSupplierUpsertRequest,
)
from app.shared.events import DropshipFulfillmentRequested
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError
from app.shared.outbox import publish_domain_event
from app.shared.schemas import PaymentStatus

logger = logging.getLogger(__name__)

MONEY_QUANTUM = Decimal("0.01")


class ProductSupplierService:
    """Manage explicit, administrator-vetted product-to-supplier mappings."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_product_suppliers(self, product_id: int) -> ProductSupplierListResponse:
        await self._product(product_id)
        links = (
            (
                await self.db.execute(
                    select(ProductSupplier)
                    .where(ProductSupplier.product_id == product_id)
                    .order_by(ProductSupplier.is_primary.desc(), ProductSupplier.id.asc())
                )
            )
            .scalars()
            .all()
        )
        return ProductSupplierListResponse(
            product_suppliers=[ProductSupplierResponse.model_validate(link) for link in links]
        )

    async def upsert_product_supplier(
        self,
        *,
        supplier_id: int,
        product_id: int,
        request: ProductSupplierUpsertRequest,
    ) -> ProductSupplierResponse:
        """Create/update a mapping and safely select an explicit primary.

        Locking the product serializes competing mapping updates for the same
        SKU.  The partial unique index remains the final database safeguard.
        """

        supplier = await self._supplier(supplier_id, lock=True)
        if not supplier.is_active or not supplier.is_verified:
            raise ResourceConflictError(
                "Only active, verified suppliers can be linked for dropship fulfilment."
            )

        product = await self._product(product_id, lock=True)
        # Draft products need sourcing configured *before* ProductService will
        # publish them, so inactive records are intentionally linkable here.
        if request.is_primary and not product.is_dropship_enabled:
            raise ResourceConflictError(
                "A primary dropship supplier requires a dropship-enabled product."
            )

        link = await self.db.scalar(
            select(ProductSupplier)
            .where(
                ProductSupplier.product_id == product_id,
                ProductSupplier.supplier_id == supplier_id,
            )
            .with_for_update()
        )

        if request.is_primary:
            clear_primary = update(ProductSupplier).where(
                ProductSupplier.product_id == product_id,
                ProductSupplier.is_primary.is_(True),
            )
            if link is not None:
                clear_primary = clear_primary.where(ProductSupplier.id != link.id)
            await self.db.execute(clear_primary.values(is_primary=False))

        if link is None:
            link = ProductSupplier(
                product_id=product_id,
                supplier_id=supplier_id,
                supplier_sku=request.supplier_sku,
                unit_cost_usd=request.unit_cost_usd,
                lead_time_days=request.lead_time_days,
                is_primary=request.is_primary,
                is_active=request.is_active,
            )
            self.db.add(link)
        else:
            link.supplier_sku = request.supplier_sku
            link.unit_cost_usd = request.unit_cost_usd
            link.lead_time_days = request.lead_time_days
            link.is_primary = request.is_primary
            link.is_active = request.is_active

        await self.db.flush()
        await self.db.refresh(link)
        return ProductSupplierResponse.model_validate(link)

    async def _supplier(self, supplier_id: int, *, lock: bool = False) -> Supplier:
        query = select(Supplier).where(Supplier.id == supplier_id)
        if lock:
            query = query.with_for_update()
        supplier = (await self.db.execute(query)).scalar_one_or_none()
        if supplier is None:
            raise ResourceNotFoundError("Supplier", supplier_id)
        return supplier

    async def _product(self, product_id: int, *, lock: bool = False) -> ProductTemplate:
        query = select(ProductTemplate).where(ProductTemplate.id == product_id)
        if lock:
            query = query.with_for_update()
        product = (await self.db.execute(query)).scalar_one_or_none()
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        return product


class DropshipFulfillmentService:
    """Create one local, idempotent dropship PO per supplier and paid order."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_purchase_orders_for_paid_order(self, order_id: int) -> list[PurchaseOrder]:
        """Create supplier POs only for a confirmed payment transaction.

        The caller is expected to invoke this from the payment-confirmation
        transition.  The payment status guard makes direct/retry invocation
        harmless, while the durable ``fulfillment_key`` prevents duplicate POs
        if two confirmed-payment paths ever race.
        """

        order = await self.db.scalar(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id)
            .with_for_update()
        )
        if order is None:
            raise ResourceNotFoundError("SaleOrder", order_id)
        if order.payment_status != PaymentStatus.PAID.value or not order.is_dropship:
            return []

        product_ids = {line.product_id for line in order.order_lines}
        if not product_ids:
            return []
        products_by_id = {
            product.id: product
            for product in (
                await self.db.execute(
                    select(ProductTemplate).where(ProductTemplate.id.in_(product_ids))
                )
            ).scalars()
        }
        dropship_quantities: dict[int, int] = defaultdict(int)
        for line in order.order_lines:
            product = products_by_id.get(line.product_id)
            if product is not None and product.is_dropship_enabled:
                dropship_quantities[product.id] += line.quantity

        if not dropship_quantities:
            return []

        links_by_product = {
            link.product_id: link
            for link in (
                await self.db.execute(
                    select(ProductSupplier)
                    .options(selectinload(ProductSupplier.supplier))
                    .join(Supplier)
                    .where(
                        ProductSupplier.product_id.in_(dropship_quantities),
                        ProductSupplier.is_primary.is_(True),
                        ProductSupplier.is_active.is_(True),
                        Supplier.is_active.is_(True),
                        Supplier.is_verified.is_(True),
                    )
                )
            ).scalars()
        }

        groups: dict[int, list[tuple[ProductTemplate, ProductSupplier, int]]] = defaultdict(list)
        missing_product_ids: list[int] = []
        for product_id, quantity in dropship_quantities.items():
            link = links_by_product.get(product_id)
            product = products_by_id[product_id]
            if link is None:
                missing_product_ids.append(product_id)
                continue
            groups[link.supplier_id].append((product, link, quantity))

        if missing_product_ids:
            # Do not guess a supplier or expose a customer's shipping data.
            # The paid order remains auditable and procurement can safely add
            # a vetted mapping before any future retry/reconciliation action.
            logger.error(
                "Paid dropship order %s has no active verified primary supplier for product ids=%s",
                order.id,
                sorted(missing_product_ids),
            )

        created: list[PurchaseOrder] = []
        for supplier_id, group in groups.items():
            fulfillment_key = self._fulfillment_key(order.id, supplier_id)
            existing = await self.db.scalar(
                select(PurchaseOrder)
                .where(PurchaseOrder.fulfillment_key == fulfillment_key)
                .with_for_update()
            )
            if existing is not None:
                continue

            purchase_order = await self._create_purchase_order(
                order=order,
                supplier_id=supplier_id,
                fulfillment_key=fulfillment_key,
                lines=group,
            )
            if purchase_order is None:
                continue
            created.append(purchase_order)

            # This compact event intentionally carries references only.  A
            # future authorized provider adapter can load its own minimum data
            # after staff approval; the durable outbox never carries a name,
            # email, telephone number, or delivery address.
            await publish_domain_event(
                self.db,
                DropshipFulfillmentRequested(
                    payload={
                        "order_id": order.id,
                        "purchase_order_id": purchase_order.id,
                        "po_number": purchase_order.po_number,
                        "supplier_id": supplier_id,
                        "line_count": len(group),
                    }
                ),
            )

        return created

    async def _create_purchase_order(
        self,
        *,
        order: SaleOrder,
        supplier_id: int,
        fulfillment_key: str,
        lines: list[tuple[ProductTemplate, ProductSupplier, int]],
    ) -> PurchaseOrder | None:
        """Persist one PO, safely recovering if a concurrent insert won."""

        expected_delivery_date = date.today() + timedelta(
            days=max(
                (
                    link.lead_time_days
                    if link.lead_time_days is not None
                    else link.supplier.lead_time_days
                )
                for _, link, _ in lines
            )
        )
        serialized_items: list[dict[str, object]] = []
        total_amount = Decimal("0.00")
        for product, link, quantity in lines:
            unit_cost = self._money(link.unit_cost_usd)
            line_total = self._money(unit_cost * quantity)
            total_amount += line_total
            serialized_items.append(
                {
                    "product_id": product.id,
                    "sku": product.sku,
                    "supplier_sku": link.supplier_sku,
                    "quantity": quantity,
                    "unit_cost": str(unit_cost),
                    "line_total": str(line_total),
                }
            )

        purchase_order = PurchaseOrder(
            po_number=f"PO-DS-{order.id}-{supplier_id}",
            supplier_id=supplier_id,
            sale_order_id=order.id,
            fulfillment_key=fulfillment_key,
            status="draft",
            items_payload={"schema_version": 1, "items": serialized_items},
            total_amount=self._money(total_amount),
            currency="USD",
            expected_delivery_date=expected_delivery_date,
        )
        try:
            async with self.db.begin_nested():
                self.db.add(purchase_order)
                await self.db.flush()
        except IntegrityError:
            recovered = await self.db.scalar(
                select(PurchaseOrder).where(PurchaseOrder.fulfillment_key == fulfillment_key)
            )
            if recovered is not None:
                return None
            raise

        return purchase_order

    @staticmethod
    def _fulfillment_key(order_id: int, supplier_id: int) -> str:
        return f"dropship:{order_id}:{supplier_id}"

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

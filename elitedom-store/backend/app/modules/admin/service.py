"""Query and command layer for the privileged staff administration console.

The console deliberately reads persisted local data only. It never invents carrier,
ERP, payment, or supplier state when a connected provider has not recorded it.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    B2BRFQ,
    Partner,
    ProductCategory,
    ProductTemplate,
    RMATicket,
    SaleOrder,
    SaleOrderLine,
    StockPicking,
)
from app.modules.admin.schemas import (
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminCustomerSummary,
    AdminDashboardMetrics,
    AdminDashboardResponse,
    AdminOrderDetail,
    AdminOrderLine,
    AdminOrderListResponse,
    AdminOrderSummary,
    AdminProductListResponse,
    AdminProductSummary,
    AdminRevenueTrendPoint,
    AdminRFQListResponse,
    AdminRFQSummary,
    AdminRMAItem,
    AdminRMAListResponse,
    AdminShipmentListResponse,
    AdminShipmentSummary,
    AdminStockAdjustmentRequest,
    AdminStockAdjustmentResponse,
)
from app.modules.inventory.service import InventoryService, StockAdjustmentRequest
from app.modules.orders.service import OrderService
from app.modules.warranty.service import RMAReviewRequest, WarrantyService
from app.shared.exceptions import ResourceNotFoundError
from app.shared.schemas import OrderState, PaymentStatus, RFQStatus, RMAStatus


class AdminService:
    """Administratively scoped reporting and operations on current persistence."""

    LOW_STOCK_THRESHOLD = 5

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Dashboard ────────────────────────────────────────────────────────

    async def dashboard(self, *, days: int = 7) -> AdminDashboardResponse:
        """Return a small dashboard snapshot and a bounded daily revenue trend."""
        now = datetime.now(UTC)
        today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)
        trend_start_date = now.date() - timedelta(days=days - 1)
        trend_start = datetime.combine(trend_start_date, time.min, tzinfo=UTC)
        paid_order_filter = and_(
            SaleOrder.payment_status == PaymentStatus.PAID.value,
            SaleOrder.state != OrderState.CANCEL.value,
        )

        total_customers = await self._count(
            select(func.count())
            .select_from(Partner)
            .where(Partner.role.in_(["customer", "b2b_client"]))
        )
        total_orders = await self._count(select(func.count()).select_from(SaleOrder))
        orders_today = await self._count(
            select(func.count()).select_from(SaleOrder).where(SaleOrder.created_at >= today_start)
        )
        paid_revenue = await self._sum_amount(
            select(func.coalesce(func.sum(SaleOrder.amount_total), 0)).where(paid_order_filter)
        )
        paid_revenue_today = await self._sum_amount(
            select(func.coalesce(func.sum(SaleOrder.amount_total), 0)).where(
                paid_order_filter,
                SaleOrder.created_at >= today_start,
            )
        )
        pending_orders = await self._count(
            select(func.count())
            .select_from(SaleOrder)
            .where(SaleOrder.state.in_([OrderState.DRAFT.value, OrderState.SENT.value]))
        )
        pending_shipments = await self._count(
            select(func.count())
            .select_from(SaleOrder)
            .where(SaleOrder.state.in_([OrderState.SALE.value, OrderState.SENT.value]))
        )
        low_stock_products = await self._count(
            select(func.count())
            .select_from(ProductTemplate)
            .where(
                ProductTemplate.is_active.is_(True),
                ProductTemplate.is_dropship_enabled.is_(False),
                ProductTemplate.stock_qty <= self.LOW_STOCK_THRESHOLD,
            )
        )
        pending_rma_claims = await self._count(
            select(func.count())
            .select_from(RMATicket)
            .where(RMATicket.status == RMAStatus.PENDING_REVIEW.value)
        )
        active_rfqs = await self._count(
            select(func.count())
            .select_from(B2BRFQ)
            .where(B2BRFQ.status.in_([RFQStatus.SUBMITTED.value, RFQStatus.UNDER_REVIEW.value]))
        )

        trend_rows = (
            await self.db.execute(
                select(
                    func.date(SaleOrder.created_at),
                    func.count(SaleOrder.id),
                    func.coalesce(
                        func.sum(SaleOrder.amount_total).filter(paid_order_filter),
                        0,
                    ),
                )
                .where(SaleOrder.created_at >= trend_start)
                .group_by(func.date(SaleOrder.created_at))
                .order_by(func.date(SaleOrder.created_at))
            )
        ).all()
        trend_by_day: dict[date, tuple[int, Decimal]] = {}
        for row_day, order_count, revenue in trend_rows:
            if row_day is None:
                continue
            normalized_day = self._as_date(row_day)
            trend_by_day[normalized_day] = (int(order_count or 0), self._decimal(revenue))

        revenue_trend = [
            AdminRevenueTrendPoint(
                date=trend_start_date + timedelta(days=offset),
                orders=trend_by_day.get(
                    trend_start_date + timedelta(days=offset), (0, Decimal("0.00"))
                )[0],
                paid_revenue=trend_by_day.get(
                    trend_start_date + timedelta(days=offset), (0, Decimal("0.00"))
                )[1],
            )
            for offset in range(days)
        ]
        recent_orders = await self._recent_orders(limit=6)
        low_stock = await self._low_stock_products(limit=6)

        return AdminDashboardResponse(
            metrics=AdminDashboardMetrics(
                total_customers=total_customers,
                total_orders=total_orders,
                orders_today=orders_today,
                paid_revenue=paid_revenue,
                paid_revenue_today=paid_revenue_today,
                pending_orders=pending_orders,
                pending_shipments=pending_shipments,
                low_stock_products=low_stock_products,
                pending_rma_claims=pending_rma_claims,
                active_rfqs=active_rfqs,
            ),
            revenue_trend=revenue_trend,
            recent_orders=recent_orders,
            low_stock=low_stock,
        )

    # ── Orders ───────────────────────────────────────────────────────────

    async def list_orders(
        self,
        *,
        page: int,
        limit: int,
        state: OrderState | None = None,
        payment_status: PaymentStatus | None = None,
        query: str | None = None,
    ) -> AdminOrderListResponse:
        filters = self._order_filters(state, payment_status, query)
        count_query = (
            select(func.count())
            .select_from(SaleOrder)
            .join(Partner, SaleOrder.partner_id == Partner.id)
            .where(*filters)
        )
        total_count = await self._count(count_query)
        rows = (
            await self.db.execute(
                select(SaleOrder, Partner.name, Partner.email, Partner.phone)
                .join(Partner, SaleOrder.partner_id == Partner.id)
                .where(*filters)
                .order_by(SaleOrder.created_at.desc(), SaleOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminOrderListResponse(
            orders=[self._order_summary(*row) for row in rows],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def get_order(self, order_id: int) -> AdminOrderDetail:
        row = (
            await self.db.execute(
                select(SaleOrder, Partner.name, Partner.email, Partner.phone)
                .join(Partner, SaleOrder.partner_id == Partner.id)
                .where(SaleOrder.id == order_id)
            )
        ).one_or_none()
        if row is None:
            raise ResourceNotFoundError("SaleOrder", order_id)
        order, customer_name, customer_email, customer_phone = row
        lines = (
            await self.db.execute(
                select(SaleOrderLine, ProductTemplate.name, ProductTemplate.sku)
                .join(ProductTemplate, SaleOrderLine.product_id == ProductTemplate.id)
                .where(SaleOrderLine.order_id == order.id)
                .order_by(SaleOrderLine.id)
            )
        ).all()
        summary = self._order_summary(order, customer_name, customer_email, customer_phone)
        return AdminOrderDetail(
            **summary.model_dump(),
            amount_subtotal=order.amount_subtotal,
            amount_shipping=order.amount_shipping,
            amount_tax=order.amount_tax,
            shipping_address=order.shipping_address,
            notes=order.notes,
            odoo_order_id=order.odoo_order_id,
            order_lines=[
                AdminOrderLine(
                    id=line.id,
                    product_id=line.product_id,
                    product_name=product_name,
                    sku=sku,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    discount_percent=line.discount_percent,
                    line_total=line.line_total,
                )
                for line, product_name, sku in lines
            ],
        )

    async def update_order_state(self, order_id: int, target_state: OrderState) -> AdminOrderDetail:
        await OrderService(self.db).update_order_state(order_id, target_state)
        return await self.get_order(order_id)

    # ── Product and stock operations ─────────────────────────────────────

    async def list_products(
        self,
        *,
        page: int,
        limit: int,
        query: str | None = None,
        low_stock_only: bool = False,
        active: bool | None = None,
    ) -> AdminProductListResponse:
        filters = self._product_filters(query, low_stock_only, active)
        count_query = select(func.count()).select_from(ProductTemplate).where(*filters)
        total_count = await self._count(count_query)
        rows = (
            await self.db.execute(
                select(ProductTemplate, ProductCategory.name)
                .outerjoin(ProductCategory, ProductTemplate.category_id == ProductCategory.id)
                .where(*filters)
                .order_by(ProductTemplate.updated_at.desc(), ProductTemplate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminProductListResponse(
            products=[
                self._product_summary(product, category_name) for product, category_name in rows
            ],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def adjust_product_stock(
        self, product_id: int, request: AdminStockAdjustmentRequest
    ) -> AdminStockAdjustmentResponse:
        product = await self.db.scalar(
            select(ProductTemplate).where(ProductTemplate.id == product_id)
        )
        if product is None:
            raise ResourceNotFoundError("Product", product_id)
        adjustment = await InventoryService(self.db).adjust_stock(
            StockAdjustmentRequest(
                sku=product.sku,
                quantity_delta=request.quantity_delta,
                reason=request.reason,
            )
        )
        return AdminStockAdjustmentResponse(product_id=product.id, **adjustment.model_dump())

    # ── Customers ────────────────────────────────────────────────────────

    async def list_customers(
        self,
        *,
        page: int,
        limit: int,
        query: str | None = None,
        active: bool | None = None,
    ) -> AdminCustomerListResponse:
        filters = self._customer_filters(query, active)
        total_count = await self._count(select(func.count()).select_from(Partner).where(*filters))
        order_count = self._partner_order_count()
        lifetime_value = self._partner_lifetime_value()
        rows = (
            await self.db.execute(
                select(Partner, order_count, lifetime_value)
                .where(*filters)
                .order_by(Partner.created_at.desc(), Partner.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminCustomerListResponse(
            customers=[
                self._customer_summary(partner, count, value) for partner, count, value in rows
            ],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def get_customer(self, customer_id: int) -> AdminCustomerDetail:
        order_count = self._partner_order_count()
        lifetime_value = self._partner_lifetime_value()
        last_order_at = (
            select(func.max(SaleOrder.created_at))
            .where(SaleOrder.partner_id == Partner.id)
            .correlate(Partner)
            .scalar_subquery()
        )
        row = (
            await self.db.execute(
                select(Partner, order_count, lifetime_value, last_order_at).where(
                    Partner.id == customer_id, *self._customer_filters(None, None)
                )
            )
        ).one_or_none()
        if row is None:
            raise ResourceNotFoundError("Customer", customer_id)
        partner, count, value, latest_order = row
        summary = self._customer_summary(partner, count, value)
        return AdminCustomerDetail(
            **summary.model_dump(),
            street_address=partner.street_address,
            last_order_at=latest_order,
        )

    # ── Warranty / RMA ───────────────────────────────────────────────────

    async def list_rmas(
        self,
        *,
        page: int,
        limit: int,
        status: RMAStatus | None = None,
        query: str | None = None,
    ) -> AdminRMAListResponse:
        filters = self._rma_filters(status, query)
        count_query = (
            select(func.count())
            .select_from(RMATicket)
            .join(Partner, RMATicket.partner_id == Partner.id)
            .join(SaleOrder, RMATicket.order_id == SaleOrder.id)
            .join(ProductTemplate, RMATicket.product_id == ProductTemplate.id)
            .where(*filters)
        )
        total_count = await self._count(count_query)
        rows = (
            await self.db.execute(
                select(
                    RMATicket,
                    Partner.name,
                    Partner.email,
                    SaleOrder.name,
                    ProductTemplate.name,
                    ProductTemplate.sku,
                )
                .join(Partner, RMATicket.partner_id == Partner.id)
                .join(SaleOrder, RMATicket.order_id == SaleOrder.id)
                .join(ProductTemplate, RMATicket.product_id == ProductTemplate.id)
                .where(*filters)
                .order_by(RMATicket.created_at.desc(), RMATicket.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminRMAListResponse(
            claims=[self._rma_item(*row) for row in rows],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def review_rma(
        self, ticket_number: str, reviewer_id: int, request: RMAReviewRequest
    ) -> AdminRMAItem:
        await WarrantyService(self.db).review_claim(ticket_number, reviewer_id, request)
        item = await self._get_rma_item(ticket_number)
        if item is None:
            raise ResourceNotFoundError("RMATicket", ticket_number)
        return item

    # ── B2B RFQs ─────────────────────────────────────────────────────────

    async def list_rfqs(
        self,
        *,
        page: int,
        limit: int,
        status: RFQStatus | None = None,
        query: str | None = None,
    ) -> AdminRFQListResponse:
        filters = self._rfq_filters(status, query)
        total_count = await self._count(
            select(func.count())
            .select_from(B2BRFQ)
            .join(Partner, B2BRFQ.partner_id == Partner.id)
            .where(*filters)
        )
        rows = (
            await self.db.execute(
                select(B2BRFQ, Partner.name, Partner.email)
                .join(Partner, B2BRFQ.partner_id == Partner.id)
                .where(*filters)
                .order_by(B2BRFQ.created_at.desc(), B2BRFQ.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminRFQListResponse(
            rfqs=[self._rfq_summary(*row) for row in rows],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    # ── Fulfilment ───────────────────────────────────────────────────────

    async def list_shipments(
        self,
        *,
        page: int,
        limit: int,
        state: str | None = None,
        query: str | None = None,
    ) -> AdminShipmentListResponse:
        filters = self._shipment_filters(state, query)
        count_query = (
            select(func.count())
            .select_from(StockPicking)
            .outerjoin(SaleOrder, StockPicking.sale_id == SaleOrder.id)
            .outerjoin(Partner, SaleOrder.partner_id == Partner.id)
            .where(*filters)
        )
        total_count = await self._count(count_query)
        rows = (
            await self.db.execute(
                select(StockPicking, SaleOrder, Partner.name)
                .outerjoin(SaleOrder, StockPicking.sale_id == SaleOrder.id)
                .outerjoin(Partner, SaleOrder.partner_id == Partner.id)
                .where(*filters)
                .order_by(StockPicking.created_at.desc(), StockPicking.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()
        return AdminShipmentListResponse(
            shipments=[self._shipment_summary(*row) for row in rows],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    # ── Serializers ──────────────────────────────────────────────────────

    async def _recent_orders(self, *, limit: int) -> list[AdminOrderSummary]:
        rows = (
            await self.db.execute(
                select(SaleOrder, Partner.name, Partner.email, Partner.phone)
                .join(Partner, SaleOrder.partner_id == Partner.id)
                .order_by(SaleOrder.created_at.desc(), SaleOrder.id.desc())
                .limit(limit)
            )
        ).all()
        return [self._order_summary(*row) for row in rows]

    async def _low_stock_products(self, *, limit: int) -> list[AdminProductSummary]:
        rows = (
            await self.db.execute(
                select(ProductTemplate, ProductCategory.name)
                .outerjoin(ProductCategory, ProductTemplate.category_id == ProductCategory.id)
                .where(
                    ProductTemplate.is_active.is_(True),
                    ProductTemplate.is_dropship_enabled.is_(False),
                    ProductTemplate.stock_qty <= self.LOW_STOCK_THRESHOLD,
                )
                .order_by(ProductTemplate.stock_qty.asc(), ProductTemplate.name)
                .limit(limit)
            )
        ).all()
        return [self._product_summary(product, category_name) for product, category_name in rows]

    @staticmethod
    def _order_summary(
        order: SaleOrder,
        customer_name: str,
        customer_email: str,
        customer_phone: str,
    ) -> AdminOrderSummary:
        return AdminOrderSummary(
            id=order.id,
            order_number=order.name,
            customer_id=order.partner_id,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            state=OrderState(order.state),
            payment_method=order.payment_method,
            payment_status=PaymentStatus(order.payment_status),
            amount_total=order.amount_total,
            shipping_governorate=order.shipping_governorate,
            is_dropship=order.is_dropship,
            created_at=order.created_at,
        )

    def _product_summary(
        self, product: ProductTemplate, category_name: str | None
    ) -> AdminProductSummary:
        return AdminProductSummary(
            id=product.id,
            name=product.name,
            sku=product.sku,
            brand=product.brand,
            category_name=category_name,
            list_price=product.list_price,
            stock_qty=product.stock_qty,
            tracking=product.tracking,
            is_active=product.is_active,
            is_dropship_enabled=product.is_dropship_enabled,
            stock_health=self._stock_health(product),
            updated_at=product.updated_at,
        )

    @staticmethod
    def _stock_health(product: ProductTemplate) -> str:
        if not product.is_active:
            return "inactive"
        if product.is_dropship_enabled:
            return "dropship"
        if product.stock_qty <= 0:
            return "out_of_stock"
        if product.stock_qty <= AdminService.LOW_STOCK_THRESHOLD:
            return "low_stock"
        return "healthy"

    @staticmethod
    def _customer_summary(
        partner: Partner, order_count: int | None, lifetime_value: Decimal | int | None
    ) -> AdminCustomerSummary:
        return AdminCustomerSummary(
            id=partner.id,
            name=partner.name,
            email=partner.email,
            phone=partner.phone,
            role=partner.role,
            is_active=partner.is_active,
            email_verified=partner.email_verified,
            governorate=partner.governorate,
            created_at=partner.created_at,
            order_count=int(order_count or 0),
            lifetime_value=AdminService._decimal(lifetime_value),
        )

    @staticmethod
    def _rma_item(
        ticket: RMATicket,
        customer_name: str,
        customer_email: str,
        order_number: str,
        product_name: str,
        sku: str,
    ) -> AdminRMAItem:
        return AdminRMAItem(
            ticket_number=ticket.ticket_number,
            status=RMAStatus(ticket.status),
            customer_id=ticket.partner_id,
            customer_name=customer_name,
            customer_email=customer_email,
            order_id=ticket.order_id,
            order_number=order_number,
            product_id=ticket.product_id,
            product_name=product_name,
            sku=sku,
            serial_number=ticket.serial_number,
            reason=ticket.reason,
            evidence_media_url=ticket.evidence_media_url,
            resolution_notes=ticket.resolution_notes,
            resolved_by=ticket.resolved_by,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )

    @staticmethod
    def _rfq_summary(rfq: B2BRFQ, customer_name: str, customer_email: str) -> AdminRFQSummary:
        raw_items = (
            rfq.items_payload.get("items", []) if isinstance(rfq.items_payload, dict) else []
        )
        item_count = len(raw_items) if isinstance(raw_items, list) else 0
        return AdminRFQSummary(
            id=rfq.id,
            rfq_code=rfq.rfq_code,
            status=RFQStatus(rfq.status),
            customer_id=rfq.partner_id,
            customer_name=customer_name,
            customer_email=customer_email,
            item_count=item_count,
            total_estimated_value=rfq.total_estimated_value,
            validity_date=rfq.validity_date,
            notes=rfq.notes,
            created_at=rfq.created_at,
            updated_at=rfq.updated_at,
        )

    @staticmethod
    def _shipment_summary(
        picking: StockPicking, order: SaleOrder | None, customer_name: str | None
    ) -> AdminShipmentSummary:
        return AdminShipmentSummary(
            id=picking.id,
            picking_reference=picking.name,
            picking_type=picking.picking_type,
            state=picking.state,
            order_id=order.id if order else None,
            order_number=order.name if order else None,
            order_state=OrderState(order.state) if order else None,
            customer_name=customer_name,
            tracking_number=picking.courier_tracking_ref,
            supplier_po_ref=picking.supplier_po_ref,
            scheduled_date=picking.scheduled_date,
            completed_date=picking.completed_date,
            created_at=picking.created_at,
        )

    async def _get_rma_item(self, ticket_number: str) -> AdminRMAItem | None:
        row = (
            await self.db.execute(
                select(
                    RMATicket,
                    Partner.name,
                    Partner.email,
                    SaleOrder.name,
                    ProductTemplate.name,
                    ProductTemplate.sku,
                )
                .join(Partner, RMATicket.partner_id == Partner.id)
                .join(SaleOrder, RMATicket.order_id == SaleOrder.id)
                .join(ProductTemplate, RMATicket.product_id == ProductTemplate.id)
                .where(RMATicket.ticket_number == ticket_number)
            )
        ).one_or_none()
        return self._rma_item(*row) if row else None

    # ── Filter builders ──────────────────────────────────────────────────

    @staticmethod
    def _order_filters(
        state: OrderState | None, payment_status: PaymentStatus | None, query: str | None
    ) -> list:
        filters: list = []
        if state is not None:
            filters.append(SaleOrder.state == state.value)
        if payment_status is not None:
            filters.append(SaleOrder.payment_status == payment_status.value)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    SaleOrder.name.ilike(pattern),
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                )
            )
        return filters

    def _product_filters(
        self, query: str | None, low_stock_only: bool, active: bool | None
    ) -> list:
        filters: list = []
        if active is not None:
            filters.append(ProductTemplate.is_active.is_(active))
        if low_stock_only:
            filters.extend(
                [
                    ProductTemplate.is_dropship_enabled.is_(False),
                    ProductTemplate.stock_qty <= self.LOW_STOCK_THRESHOLD,
                ]
            )
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    ProductTemplate.name.ilike(pattern),
                    ProductTemplate.sku.ilike(pattern),
                    ProductTemplate.brand.ilike(pattern),
                )
            )
        return filters

    @staticmethod
    def _customer_filters(query: str | None, active: bool | None) -> list:
        filters: list = [Partner.role.in_(["customer", "b2b_client"])]
        if active is not None:
            filters.append(Partner.is_active.is_(active))
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                    Partner.phone.ilike(pattern),
                )
            )
        return filters

    @staticmethod
    def _rma_filters(status: RMAStatus | None, query: str | None) -> list:
        filters: list = []
        if status is not None:
            filters.append(RMATicket.status == status.value)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    RMATicket.ticket_number.ilike(pattern),
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                    SaleOrder.name.ilike(pattern),
                )
            )
        return filters

    @staticmethod
    def _rfq_filters(status: RFQStatus | None, query: str | None) -> list:
        filters: list = []
        if status is not None:
            filters.append(B2BRFQ.status == status.value)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    B2BRFQ.rfq_code.ilike(pattern),
                    Partner.name.ilike(pattern),
                    Partner.email.ilike(pattern),
                )
            )
        return filters

    @staticmethod
    def _shipment_filters(state: str | None, query: str | None) -> list:
        filters: list = []
        if state:
            filters.append(StockPicking.state == state)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(
                    StockPicking.name.ilike(pattern),
                    StockPicking.courier_tracking_ref.ilike(pattern),
                    SaleOrder.name.ilike(pattern),
                    Partner.name.ilike(pattern),
                )
            )
        return filters

    @staticmethod
    def _partner_order_count():
        return (
            select(func.count(SaleOrder.id))
            .where(SaleOrder.partner_id == Partner.id)
            .correlate(Partner)
            .scalar_subquery()
        )

    @staticmethod
    def _partner_lifetime_value():
        return (
            select(func.coalesce(func.sum(SaleOrder.amount_total), 0))
            .where(
                SaleOrder.partner_id == Partner.id,
                SaleOrder.state != OrderState.CANCEL.value,
            )
            .correlate(Partner)
            .scalar_subquery()
        )

    async def _count(self, statement) -> int:
        return int((await self.db.scalar(statement)) or 0)

    async def _sum_amount(self, statement) -> Decimal:
        return self._decimal(await self.db.scalar(statement))

    @staticmethod
    def _decimal(value: Decimal | int | float | None) -> Decimal:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))

    @staticmethod
    def _as_date(value: date | datetime | str) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return date.fromisoformat(str(value))

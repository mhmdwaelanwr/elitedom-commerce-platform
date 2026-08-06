"""Database-backed commercial reporting for authorized staff dashboards."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Partner,
    ProductTemplate,
    PurchaseOrder,
    RMATicket,
    SaleOrder,
    SaleOrderLine,
    Supplier,
)
from app.modules.reporting.schemas import (
    DashboardResponse,
    InventoryReportResponse,
    LowStockProductResponse,
    RecentOrderResponse,
    RevenueSeriesPoint,
    RmaTrendResponse,
    SalesReportResponse,
    SupplierReportItem,
    SupplierReportResponse,
    TopProductResponse,
)

FINALIZED_ORDER_STATES = ("sale", "done")
MONEY_QUANTUM = Decimal("0.01")
ReportPeriod = Literal["daily", "weekly", "monthly", "yearly"]


class ReportingService:
    """Generate admin reporting directly from durable application state."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def dashboard(self, *, days: int = 30) -> DashboardResponse:
        now = datetime.now(UTC)
        start_at = now - timedelta(days=days)
        finalized_orders = await self._orders(start_at=start_at, finalized_only=True)
        all_orders = await self._orders(start_at=start_at, finalized_only=False)
        total_revenue = self._money(
            sum((order.amount_total for order in finalized_orders), Decimal("0"))
        )
        total_orders = len(finalized_orders)
        active_customers = await self._active_customer_count()
        orders_by_state = dict(Counter(order.state for order in all_orders))
        return DashboardResponse(
            generated_at=now,
            total_revenue=total_revenue,
            total_orders=total_orders,
            paid_orders=sum(order.payment_status == "paid" for order in all_orders),
            active_customers=active_customers,
            average_order_value=self._money(total_revenue / total_orders)
            if total_orders
            else Decimal("0.00"),
            orders_by_state=orders_by_state,
            revenue_series=self._series(finalized_orders, "daily"),
            best_sellers=await self._best_sellers(start_at=start_at),
            low_stock_products=await self._low_stock_products(),
            recent_orders=[self._recent_order(order) for order in all_orders[:8]],
        )

    async def sales_report(
        self,
        *,
        period: ReportPeriod,
        start_at: datetime | None,
        end_at: datetime | None,
    ) -> SalesReportResponse:
        orders = await self._orders(start_at=start_at, end_at=end_at, finalized_only=True)
        total_revenue = self._money(sum((order.amount_total for order in orders), Decimal("0")))
        return SalesReportResponse(
            period=period,
            start_at=start_at,
            end_at=end_at,
            total_revenue=total_revenue,
            total_orders=len(orders),
            series=self._series(orders, period),
        )

    async def inventory_report(self, *, low_stock_threshold: int = 5) -> InventoryReportResponse:
        products = (
            (
                await self.db.execute(
                    select(ProductTemplate).where(ProductTemplate.is_active.is_(True))
                )
            )
            .scalars()
            .all()
        )
        return InventoryReportResponse(
            total_sku_count=len(products),
            total_units_on_hand=sum(product.stock_qty for product in products),
            total_cost_value_usd=self._money(
                sum(
                    (product.base_cost_usd * product.stock_qty for product in products),
                    Decimal("0"),
                )
            ),
            total_retail_value_egp=self._money(
                sum(
                    (product.list_price * product.stock_qty for product in products),
                    Decimal("0"),
                )
            ),
            low_stock_products=await self._low_stock_products(low_stock_threshold),
        )

    async def rma_trends(self, *, days: int = 90) -> RmaTrendResponse:
        recent_since = datetime.now(UTC) - timedelta(days=days)
        tickets = (await self.db.execute(select(RMATicket))).scalars().all()
        return RmaTrendResponse(
            total_claims=len(tickets),
            claims_by_status=dict(Counter(ticket.status for ticket in tickets)),
            recent_claims=sum(
                self._as_utc(ticket.created_at) >= recent_since for ticket in tickets
            ),
        )

    async def supplier_report(self) -> SupplierReportResponse:
        suppliers = (
            (await self.db.execute(select(Supplier).order_by(Supplier.name))).scalars().all()
        )
        purchase_orders = (await self.db.execute(select(PurchaseOrder))).scalars().all()
        by_supplier: dict[int, list[PurchaseOrder]] = defaultdict(list)
        for order in purchase_orders:
            by_supplier[order.supplier_id].append(order)
        return SupplierReportResponse(
            suppliers=[
                SupplierReportItem(
                    supplier_id=supplier.id,
                    name=supplier.name,
                    is_active=supplier.is_active,
                    total_purchase_orders=len(by_supplier[supplier.id]),
                    received_purchase_orders=sum(
                        order.status == "received" for order in by_supplier[supplier.id]
                    ),
                    open_purchase_orders=sum(
                        order.status in {"draft", "sent", "partial"}
                        for order in by_supplier[supplier.id]
                    ),
                    performance_rating=supplier.performance_rating,
                    defect_rate_percent=supplier.defect_rate_percent,
                )
                for supplier in suppliers
            ]
        )

    async def sales_rows_for_csv(
        self, *, start_at: datetime | None, end_at: datetime | None
    ) -> list[tuple[str, str, str, str, str]]:
        orders = await self._orders(start_at=start_at, end_at=end_at, finalized_only=True)
        return [
            (
                order.name,
                self._as_utc(order.created_at).isoformat(),
                order.state,
                order.payment_status,
                f"{self._money(order.amount_total):.2f}",
            )
            for order in orders
        ]

    async def _orders(
        self,
        *,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        finalized_only: bool,
    ) -> list[SaleOrder]:
        query = select(SaleOrder)
        if finalized_only:
            query = query.where(SaleOrder.state.in_(FINALIZED_ORDER_STATES))
        if start_at is not None:
            query = query.where(SaleOrder.created_at >= self._as_utc(start_at))
        if end_at is not None:
            query = query.where(SaleOrder.created_at <= self._as_utc(end_at))
        query = query.order_by(SaleOrder.created_at.desc(), SaleOrder.id.desc())
        return list((await self.db.execute(query)).scalars())

    async def _active_customer_count(self) -> int:
        count = await self.db.execute(
            select(func.count())
            .select_from(Partner)
            .where(
                Partner.is_active.is_(True),
                Partner.role.in_(("customer", "b2b_client")),
            )
        )
        return count.scalar_one()

    async def _best_sellers(self, *, start_at: datetime) -> list[TopProductResponse]:
        result = await self.db.execute(
            select(
                ProductTemplate.id,
                ProductTemplate.sku,
                ProductTemplate.name,
                func.coalesce(func.sum(SaleOrderLine.quantity), 0).label("units_sold"),
                func.coalesce(func.sum(SaleOrderLine.line_total), 0).label("revenue"),
            )
            .join(SaleOrderLine, SaleOrderLine.product_id == ProductTemplate.id)
            .join(SaleOrder, SaleOrder.id == SaleOrderLine.order_id)
            .where(
                SaleOrder.state.in_(FINALIZED_ORDER_STATES),
                SaleOrder.created_at >= start_at,
            )
            .group_by(ProductTemplate.id, ProductTemplate.sku, ProductTemplate.name)
            .order_by(func.sum(SaleOrderLine.quantity).desc(), ProductTemplate.name.asc())
            .limit(8)
        )
        return [
            TopProductResponse(
                product_id=row.id,
                sku=row.sku,
                name=row.name,
                units_sold=int(row.units_sold),
                revenue=self._money(Decimal(row.revenue)),
            )
            for row in result
        ]

    async def _low_stock_products(self, threshold: int = 5) -> list[LowStockProductResponse]:
        products = (
            (
                await self.db.execute(
                    select(ProductTemplate)
                    .where(
                        ProductTemplate.is_active.is_(True),
                        ProductTemplate.stock_qty <= threshold,
                    )
                    .order_by(ProductTemplate.stock_qty.asc(), ProductTemplate.name.asc())
                    .limit(20)
                )
            )
            .scalars()
            .all()
        )
        return [
            LowStockProductResponse(
                product_id=product.id,
                sku=product.sku,
                name=product.name,
                stock_qty=product.stock_qty,
                is_dropship_enabled=product.is_dropship_enabled,
            )
            for product in products
        ]

    def _series(self, orders: list[SaleOrder], period: ReportPeriod) -> list[RevenueSeriesPoint]:
        buckets: dict[str, dict[str, Decimal | int]] = {}
        for order in orders:
            key = self._period_key(self._as_utc(order.created_at), period)
            bucket = buckets.setdefault(key, {"order_count": 0, "revenue": Decimal("0.00")})
            bucket["order_count"] = int(bucket["order_count"]) + 1
            bucket["revenue"] = Decimal(bucket["revenue"]) + order.amount_total
        return [
            RevenueSeriesPoint(
                period=key,
                order_count=int(bucket["order_count"]),
                revenue=self._money(Decimal(bucket["revenue"])),
            )
            for key, bucket in sorted(buckets.items())
        ]

    @staticmethod
    def _period_key(timestamp: datetime, period: ReportPeriod) -> str:
        if period == "daily":
            return timestamp.date().isoformat()
        if period == "weekly":
            iso_year, iso_week, _ = timestamp.isocalendar()
            return f"{iso_year}-W{iso_week:02d}"
        if period == "monthly":
            return f"{timestamp.year}-{timestamp.month:02d}"
        return str(timestamp.year)

    @staticmethod
    def _recent_order(order: SaleOrder) -> RecentOrderResponse:
        return RecentOrderResponse(
            order_id=order.id,
            order_number=order.name,
            state=order.state,
            payment_status=order.payment_status,
            amount_total=order.amount_total,
            created_at=order.created_at,
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

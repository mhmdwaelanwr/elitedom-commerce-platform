"""Coverage for database-backed reporting instead of placeholder metrics."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Partner, ProductTemplate, SaleOrder, SaleOrderLine
from app.modules.reporting.router import _sales_pdf
from app.modules.reporting.service import ReportingService


@pytest.mark.asyncio
async def test_dashboard_and_sales_report_use_finalized_order_data(
    db_session: AsyncSession,
) -> None:
    now = datetime.now(UTC)
    customer = Partner(
        name="Reporting Customer",
        email="reporting@example.com",
        phone="01012345678",
        password_hash="not-used",
        role="customer",
    )
    product = ProductTemplate(
        name="Reporting GPU",
        sku="REPORT-GPU-001",
        base_cost_usd=Decimal("200.00"),
        target_margin_percent=Decimal("20.00"),
        list_price=Decimal("10000.00"),
        stock_qty=3,
    )
    db_session.add_all([customer, product])
    await db_session.flush()
    order = SaleOrder(
        name="SO-REPORT-001",
        partner_id=customer.id,
        state="sale",
        payment_method="credit_card",
        payment_status="paid",
        amount_subtotal=Decimal("20000.00"),
        amount_shipping=Decimal("0.00"),
        amount_tax=Decimal("0.00"),
        amount_total=Decimal("20000.00"),
        shipping_address="10 Tahrir Square, Cairo",
        created_at=now,
    )
    db_session.add(order)
    await db_session.flush()
    db_session.add(
        SaleOrderLine(
            order_id=order.id,
            product_id=product.id,
            quantity=2,
            unit_price=Decimal("10000.00"),
            discount_percent=Decimal("0.00"),
            line_total=Decimal("20000.00"),
        )
    )
    await db_session.flush()

    service = ReportingService(db_session)
    dashboard = await service.dashboard(days=30)
    assert dashboard.total_revenue == Decimal("20000.00")
    assert dashboard.total_orders == 1
    assert dashboard.paid_orders == 1
    assert dashboard.best_sellers[0].sku == product.sku
    assert dashboard.best_sellers[0].units_sold == 2

    sales = await service.sales_report(period="monthly", start_at=None, end_at=None)
    assert sales.total_orders == 1
    assert sales.series[0].revenue == Decimal("20000.00")

    inventory = await service.inventory_report(low_stock_threshold=3)
    assert inventory.total_sku_count == 1
    assert inventory.total_retail_value_egp == Decimal("30000.00")
    assert inventory.low_stock_products[0].sku == product.sku


def test_sales_pdf_export_is_a_valid_pdf_without_customer_data() -> None:
    pdf = _sales_pdf(
        [
            (
                "SO-REPORT-001",
                "2026-08-06T09:00:00+00:00",
                "sale",
                "paid",
                "20000.00",
            )
        ],
        total_revenue="20000.00",
    )

    assert pdf.startswith(b"%PDF")
    assert b"reporting@example.com" not in pdf

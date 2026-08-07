"""Permission-protected reporting, analytics, CSV, and PDF export endpoints."""

import csv
import io
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.reporting.schemas import (
    DashboardResponse,
    InventoryReportResponse,
    RmaTrendResponse,
    SalesReportResponse,
    SupplierReportResponse,
)
from app.modules.reporting.service import ReportingService
from app.shared.security import require_permission

router = APIRouter()

ReportViewer = Depends(require_permission(AdminPermission.REPORTS_VIEW.value))
InventoryViewer = Depends(require_permission(AdminPermission.INVENTORY_VIEW.value))
SupplierViewer = Depends(require_permission(AdminPermission.SUPPLIERS_VIEW.value))


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: dict = ReportViewer,
) -> DashboardResponse:
    return await ReportingService(db).dashboard(days=days)


@router.get("/sales", response_model=SalesReportResponse)
async def sales_report(
    period: Literal["daily", "weekly", "monthly", "yearly"] = Query(default="monthly"),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = ReportViewer,
) -> SalesReportResponse:
    return await ReportingService(db).sales_report(period=period, start_at=start_at, end_at=end_at)


@router.get("/sales/export")
async def export_sales_csv(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = ReportViewer,
) -> StreamingResponse:
    rows = await ReportingService(db).sales_rows_for_csv(start_at=start_at, end_at=end_at)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["order_number", "created_at", "state", "payment_status", "amount_total_egp"])
    writer.writerows(rows)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=elitedom-sales-report.csv"},
    )


@router.get("/sales/export.pdf")
async def export_sales_pdf(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = ReportViewer,
) -> StreamingResponse:
    service = ReportingService(db)
    rows = await service.sales_rows_for_csv(start_at=start_at, end_at=end_at)
    report = await service.sales_report(period="monthly", start_at=start_at, end_at=end_at)
    pdf = _sales_pdf(rows, total_revenue=str(report.total_revenue))
    return StreamingResponse(
        iter([pdf]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=elitedom-sales-report.pdf"},
    )


@router.get("/inventory", response_model=InventoryReportResponse)
async def inventory_report(
    low_stock_threshold: int = Query(default=5, ge=0, le=10_000),
    db: AsyncSession = Depends(get_db),
    current_user: dict = InventoryViewer,
) -> InventoryReportResponse:
    return await ReportingService(db).inventory_report(low_stock_threshold=low_stock_threshold)


@router.get("/rma", response_model=RmaTrendResponse)
async def rma_report(
    days: int = Query(default=90, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
    current_user: dict = ReportViewer,
) -> RmaTrendResponse:
    return await ReportingService(db).rma_trends(days=days)


@router.get("/suppliers", response_model=SupplierReportResponse)
async def supplier_performance_report(
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> SupplierReportResponse:
    return await ReportingService(db).supplier_report()


def _sales_pdf(rows: list[tuple[str, str, str, str, str]], *, total_revenue: str) -> bytes:
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=1)
    page_width, page_height = A4
    left = 18 * mm
    bottom = 18 * mm
    line_height = 6 * mm

    def draw_header() -> float:
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(left, page_height - 20 * mm, "Elitedom Store — Settled Sales")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(left, page_height - 27 * mm, f"Orders: {len(rows)}")
        pdf.drawRightString(
            page_width - left,
            page_height - 27 * mm,
            f"Total EGP: {total_revenue}",
        )
        pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
        pdf.line(left, page_height - 30 * mm, page_width - left, page_height - 30 * mm)
        pdf.setFont("Helvetica-Bold", 8)
        y = page_height - 37 * mm
        for label, x in (
            ("Order", left),
            ("Created", left + 38 * mm),
            ("State", left + 94 * mm),
            ("Payment", left + 121 * mm),
        ):
            pdf.drawString(x, y, label)
        pdf.drawRightString(page_width - left, y, "EGP")
        return y - line_height

    y = draw_header()
    pdf.setFont("Helvetica", 8)
    for order_number, created_at, state, payment_status, amount in rows:
        if y < bottom:
            pdf.showPage()
            y = draw_header()
            pdf.setFont("Helvetica", 8)
        pdf.drawString(left, y, order_number[:22])
        pdf.drawString(left + 38 * mm, y, created_at[:19])
        pdf.drawString(left + 94 * mm, y, state[:15])
        pdf.drawString(left + 121 * mm, y, payment_status[:15])
        pdf.drawRightString(page_width - left, y, amount)
        y -= line_height

    pdf.save()
    return output.getvalue()

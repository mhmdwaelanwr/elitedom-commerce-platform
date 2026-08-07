"""Finance, procurement, integration, and safe runtime configuration admin routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.admin.control_schemas import (
    AdminIntegrationStatusResponse,
    AdminPaymentAttemptListResponse,
    AdminPurchaseOrderListResponse,
    AdminPurchaseOrderSummary,
    AdminRefundListResponse,
    AdminRefundRequest,
    AdminRefundRequestResponse,
    AdminSupplierListResponse,
    AdminSupplierSummary,
)
from app.modules.admin.control_service import AdminControlPlaneService
from app.modules.suppliers.service import SupplierService
from app.shared.security import require_permission

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
PaymentViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.PAYMENTS_VIEW.value))
]
RefundManager = Annotated[
    dict, Depends(require_permission(AdminPermission.PAYMENTS_REFUND.value))
]
SupplierViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.SUPPLIERS_VIEW.value))
]
IntegrationViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.INTEGRATIONS_VIEW.value))
]
ConfigViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.CONFIG_VIEW.value))
]


@router.get("/payments", response_model=AdminPaymentAttemptListResponse)
async def list_admin_payments(
    db: DatabaseSession,
    current_user: PaymentViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: str | None = Query(default=None, min_length=1, max_length=32),
    provider: str | None = Query(default=None, min_length=1, max_length=32),
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminPaymentAttemptListResponse:
    return await AdminControlPlaneService(db).list_payments(
        page=page,
        limit=limit,
        status=status,
        provider=provider,
        query=q,
    )


@router.get("/refunds", response_model=AdminRefundListResponse)
async def list_admin_refunds(
    db: DatabaseSession,
    current_user: PaymentViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: str | None = Query(default=None, min_length=1, max_length=32),
    provider: str | None = Query(default=None, min_length=1, max_length=32),
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRefundListResponse:
    return await AdminControlPlaneService(db).list_refunds(
        page=page,
        limit=limit,
        status=status,
        provider=provider,
        query=q,
    )


@router.post("/refunds/{order_id}", response_model=AdminRefundRequestResponse)
async def request_admin_refund(
    order_id: int,
    payload: AdminRefundRequest,
    request: Request,
    db: DatabaseSession,
    current_user: RefundManager,
) -> AdminRefundRequestResponse:
    result = await AdminControlPlaneService(db).request_full_refund(
        order_id=order_id,
        reason=payload.reason,
    )
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="payment.refund.request",
        entity_type="refund",
        entity_id=result.refund_id,
        after={**result.model_dump(mode="json"), "reason": payload.reason},
        request=request,
    )
    return result


@router.get("/suppliers", response_model=AdminSupplierListResponse)
async def list_admin_suppliers(
    db: DatabaseSession,
    current_user: SupplierViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    include_inactive: bool = Query(default=True),
) -> AdminSupplierListResponse:
    result = await SupplierService(db).list_suppliers(
        page=page,
        limit=limit,
        include_inactive=include_inactive,
    )
    return AdminSupplierListResponse(
        suppliers=[AdminSupplierSummary.model_validate(item) for item in result.suppliers],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/purchase-orders", response_model=AdminPurchaseOrderListResponse)
async def list_admin_purchase_orders(
    db: DatabaseSession,
    current_user: SupplierViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    supplier_id: int | None = Query(default=None, ge=1),
    status: str | None = Query(default=None, min_length=1, max_length=32),
) -> AdminPurchaseOrderListResponse:
    result = await SupplierService(db).list_purchase_orders(
        page=page,
        limit=limit,
        supplier_id=supplier_id,
        status=status,
    )
    return AdminPurchaseOrderListResponse(
        purchase_orders=[
            AdminPurchaseOrderSummary.model_validate(item)
            for item in result.purchase_orders
        ],
        total_count=result.total_count,
        page=result.page,
        limit=result.limit,
    )


@router.get("/integrations", response_model=AdminIntegrationStatusResponse)
async def get_admin_integration_status(
    db: DatabaseSession,
    current_user: IntegrationViewer,
) -> AdminIntegrationStatusResponse:
    return AdminControlPlaneService(db).integration_status()


@router.get("/configuration", response_model=AdminIntegrationStatusResponse)
async def get_admin_runtime_configuration(
    db: DatabaseSession,
    current_user: ConfigViewer,
) -> AdminIntegrationStatusResponse:
    # Configuration is deployment-managed. The control plane exposes readiness
    # only and never returns secret values or supports in-app secret mutation.
    return AdminControlPlaneService(db).integration_status()

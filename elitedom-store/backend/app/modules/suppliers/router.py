"""Secure supplier, procurement, and goods-receipt HTTP endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.suppliers.dropship import ProductSupplierService
from app.modules.suppliers.schemas import (
    ProductSupplierListResponse,
    ProductSupplierResponse,
    ProductSupplierUpsertRequest,
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
from app.modules.suppliers.service import SupplierService
from app.shared.security import require_permission

router = APIRouter()

SupplierViewer = Depends(require_permission(AdminPermission.SUPPLIERS_VIEW.value))
SupplierManager = Depends(require_permission(AdminPermission.SUPPLIERS_MANAGE.value))


@router.get("", response_model=SupplierListResponse)
async def list_suppliers(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> SupplierListResponse:
    return await SupplierService(db).list_suppliers(
        page=page, limit=limit, include_inactive=include_inactive
    )


@router.post("", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    payload: SupplierCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierManager,
) -> SupplierResponse:
    result = await SupplierService(db).create_supplier(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="supplier.create",
        entity_type="supplier",
        entity_id=result.id,
        after=result,
        request=request,
    )
    return result


@router.get("/purchase-orders", response_model=PurchaseOrderListResponse)
async def list_purchase_orders(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    supplier_id: int | None = Query(default=None, ge=1),
    status: Literal["draft", "sent", "partial", "received", "cancelled"] | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> PurchaseOrderListResponse:
    return await SupplierService(db).list_purchase_orders(
        page=page,
        limit=limit,
        supplier_id=supplier_id,
        status=status,
    )


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    payload: PurchaseOrderCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierManager,
) -> PurchaseOrderResponse:
    result = await SupplierService(db).create_purchase_order(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="supplier.purchase_order.create",
        entity_type="purchase_order",
        entity_id=result.po_number,
        after=result,
        request=request,
    )
    return result


@router.patch("/purchase-orders/{po_number}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_number: str,
    payload: PurchaseOrderUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierManager,
) -> PurchaseOrderResponse:
    before = await SupplierService(db).get_purchase_order(po_number)
    result = await SupplierService(db).update_purchase_order(po_number, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="supplier.purchase_order.update",
        entity_type="purchase_order",
        entity_id=po_number,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.get("/products/{product_id}/supplier-links", response_model=ProductSupplierListResponse)
async def list_product_supplier_links(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> ProductSupplierListResponse:
    return await ProductSupplierService(db).list_product_suppliers(product_id)


@router.put(
    "/{supplier_id}/products/{product_id}",
    response_model=ProductSupplierResponse,
)
async def upsert_product_supplier_link(
    supplier_id: int,
    product_id: int,
    payload: ProductSupplierUpsertRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierManager,
) -> ProductSupplierResponse:
    result = await ProductSupplierService(db).upsert_product_supplier(
        supplier_id=supplier_id,
        product_id=product_id,
        request=payload,
    )
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="supplier.product_link.upsert",
        entity_type="product_supplier",
        entity_id=f"{supplier_id}:{product_id}",
        after=result,
        request=request,
    )
    return result


@router.get("/{supplier_id}/performance", response_model=SupplierPerformanceResponse)
async def get_supplier_performance(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> SupplierPerformanceResponse:
    return await SupplierService(db).supplier_performance(supplier_id)


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierViewer,
) -> SupplierResponse:
    return await SupplierService(db).get_supplier(supplier_id)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = SupplierManager,
) -> SupplierResponse:
    before = await SupplierService(db).get_supplier(supplier_id)
    result = await SupplierService(db).update_supplier(supplier_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="supplier.update",
        entity_type="supplier",
        entity_id=supplier_id,
        before=before,
        after=result,
        request=request,
    )
    return result

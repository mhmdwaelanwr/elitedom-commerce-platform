"""HTTP boundary for the permission-protected staff administration console."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.admin.schemas import (
    AdminAccessResponse,
    AdminAuditListResponse,
    AdminAuditLogItem,
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminDashboardResponse,
    AdminOrderDetail,
    AdminOrderListResponse,
    AdminOrderStateUpdateRequest,
    AdminPermissionCatalogResponse,
    AdminPermissionDefinition,
    AdminProductListResponse,
    AdminRFQListResponse,
    AdminRMAItem,
    AdminRMAListResponse,
    AdminShipmentListResponse,
    AdminStaffAccessItem,
    AdminStaffAccessUpdateRequest,
    AdminStaffListResponse,
    AdminStockAdjustmentRequest,
    AdminStockAdjustmentResponse,
)
from app.modules.admin.service import AdminService
from app.modules.auth.mfa_service import AdminMfaService
from app.modules.b2b.schemas import B2BRFQResponse, IssueQuoteRequest
from app.modules.b2b.service import B2BService
from app.modules.products.media import delete_product_image_file, store_product_image
from app.modules.products.schemas import (
    ProductCreateRequest,
    ProductDetailResponse,
    ProductImageResponse,
    ProductUpdateRequest,
)
from app.modules.products.service import ProductService
from app.modules.shipping.service import (
    DispatchOrderRequest,
    DispatchOrderResponse,
    ShippingService,
)
from app.modules.warranty.service import RMAReviewRequest
from app.shared.exceptions import InsufficientPermissionsError
from app.shared.schemas import OrderState, PaymentStatus, RFQStatus, RMAStatus
from app.shared.security import get_current_user, require_permission

router = APIRouter()
settings = get_settings()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]

DashboardViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.DASHBOARD_VIEW.value))
]
OrderViewer = Annotated[dict, Depends(require_permission(AdminPermission.ORDERS_VIEW.value))]
OrderManager = Annotated[dict, Depends(require_permission(AdminPermission.ORDERS_MANAGE.value))]
CatalogViewer = Annotated[dict, Depends(require_permission(AdminPermission.CATALOG_VIEW.value))]
CatalogManager = Annotated[dict, Depends(require_permission(AdminPermission.CATALOG_MANAGE.value))]
CatalogArchiver = Annotated[
    dict, Depends(require_permission(AdminPermission.CATALOG_ARCHIVE.value))
]
InventoryViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_VIEW.value))
]
InventoryAdjuster = Annotated[
    dict, Depends(require_permission(AdminPermission.INVENTORY_ADJUST.value))
]
CustomerViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.CUSTOMERS_VIEW.value))
]
SupportViewer = Annotated[dict, Depends(require_permission(AdminPermission.SUPPORT_VIEW.value))]
SupportManager = Annotated[
    dict, Depends(require_permission(AdminPermission.SUPPORT_MANAGE.value))
]
RfqViewer = Annotated[dict, Depends(require_permission(AdminPermission.RFQ_VIEW.value))]
RfqQuoter = Annotated[dict, Depends(require_permission(AdminPermission.RFQ_QUOTE.value))]
ShipmentViewer = Annotated[
    dict, Depends(require_permission(AdminPermission.SHIPMENTS_VIEW.value))
]
ShipmentDispatcher = Annotated[
    dict, Depends(require_permission(AdminPermission.SHIPMENTS_DISPATCH.value))
]
StaffViewer = Annotated[dict, Depends(require_permission(AdminPermission.STAFF_VIEW.value))]
StaffManager = Annotated[dict, Depends(require_permission(AdminPermission.STAFF_MANAGE.value))]
AuditViewer = Annotated[dict, Depends(require_permission(AdminPermission.AUDIT_VIEW.value))]


@router.get("/access/me", response_model=AdminAccessResponse)
async def get_my_admin_access(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> AdminAccessResponse:
    role, permissions = await AdminAccessService(db).resolve_permissions(current_user["user_id"])
    if role is None:
        raise InsufficientPermissionsError()
    if settings.staff_mfa_required:
        await AdminMfaService(db).require_verified_staff_session(
            partner_id=current_user["user_id"],
            session_id=current_user.get("session_id"),
        )
    return AdminAccessResponse(role=role, permissions=sorted(permissions))


@router.get("/access/permissions", response_model=AdminPermissionCatalogResponse)
async def get_permission_catalog(
    db: DatabaseSession,
    current_user: StaffViewer,
) -> AdminPermissionCatalogResponse:
    catalog = await AdminAccessService(db).permission_catalog()
    return AdminPermissionCatalogResponse(
        permissions=[AdminPermissionDefinition(**item) for item in catalog]
    )


@router.get("/staff", response_model=AdminStaffListResponse)
async def list_staff_access(
    db: DatabaseSession,
    current_user: StaffViewer,
) -> AdminStaffListResponse:
    rows = await AdminAccessService(db).list_staff()
    return AdminStaffListResponse(staff=[AdminStaffAccessItem(**row) for row in rows])


@router.put("/staff/{partner_id}/access", response_model=AdminStaffAccessItem)
async def update_staff_access(
    partner_id: int,
    payload: AdminStaffAccessUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: StaffManager,
) -> AdminStaffAccessItem:
    row = await AdminAccessService(db).replace_staff_access(
        target_partner_id=partner_id,
        role=payload.role,
        overrides=[item.model_dump() for item in payload.overrides],
        actor=current_user,
        request=request,
    )
    return AdminStaffAccessItem(**row)


@router.get("/audit-logs", response_model=AdminAuditListResponse)
async def list_admin_audit_logs(
    db: DatabaseSession,
    current_user: AuditViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    action: str | None = Query(default=None, min_length=1, max_length=96),
    entity_type: str | None = Query(default=None, min_length=1, max_length=64),
    actor_partner_id: int | None = Query(default=None, ge=1),
) -> AdminAuditListResponse:
    rows, total = await AdminAccessService(db).list_audit_logs(
        page=page,
        limit=limit,
        action=action,
        entity_type=entity_type,
        actor_partner_id=actor_partner_id,
    )
    return AdminAuditListResponse(
        logs=[AdminAuditLogItem.model_validate(row) for row in rows],
        total_count=total,
        page=page,
        limit=limit,
    )


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_dashboard(
    db: DatabaseSession,
    current_user: DashboardViewer,
) -> AdminDashboardResponse:
    return await AdminService(db).dashboard()


@router.get("/orders", response_model=AdminOrderListResponse)
async def list_orders(
    db: DatabaseSession,
    current_user: OrderViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    state: OrderState | None = Query(default=None),
    payment_status: PaymentStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=128),
) -> AdminOrderListResponse:
    return await AdminService(db).list_orders(
        page=page,
        limit=limit,
        state=state,
        payment_status=payment_status,
        search=search,
    )


@router.get("/orders/{order_id}", response_model=AdminOrderDetail)
async def get_order(
    order_id: int,
    db: DatabaseSession,
    current_user: OrderViewer,
) -> AdminOrderDetail:
    return await AdminService(db).get_order(order_id)


@router.put("/orders/{order_id}/state", response_model=AdminOrderDetail)
async def update_order_state(
    order_id: int,
    payload: AdminOrderStateUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: OrderManager,
) -> AdminOrderDetail:
    return await AdminService(db).update_order_state(
        order_id=order_id,
        payload=payload,
        actor=current_user,
        request=request,
    )


@router.get("/products", response_model=AdminProductListResponse)
async def list_products(
    db: DatabaseSession,
    current_user: CatalogViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    search: str | None = Query(default=None, max_length=128),
) -> AdminProductListResponse:
    return await AdminService(db).list_products(page=page, limit=limit, search=search)


@router.post("/products", response_model=ProductDetailResponse, status_code=201)
async def create_product(
    payload: ProductCreateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> ProductDetailResponse:
    result = await ProductService(db).create(payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.create",
        entity_type="product",
        entity_id=result.id,
        after=result,
        request=request,
    )
    return result


@router.put("/products/{product_id}", response_model=ProductDetailResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdateRequest,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
) -> ProductDetailResponse:
    before = await ProductService(db).get_by_id(product_id)
    result = await ProductService(db).update(product_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.update",
        entity_type="product",
        entity_id=product_id,
        before=before,
        after=result,
        request=request,
    )
    return result


@router.post("/products/{product_id}/archive", status_code=204)
async def archive_product(
    product_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogArchiver,
):
    before = await ProductService(db).get_by_id(product_id)
    await ProductService(db).archive(product_id)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.archive",
        entity_type="product",
        entity_id=product_id,
        before=before,
        after={"is_active": False},
        request=request,
    )
    return None


@router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=201)
async def upload_product_image(
    product_id: int,
    request: Request,
    db: DatabaseSession,
    current_user: CatalogManager,
    image: UploadFile = File(...),
) -> ProductImageResponse:
    stored = await store_product_image(image)
    try:
        result = await ProductService(db).add_image(product_id, stored.url)
    except Exception:
        delete_product_image_file(stored.url)
        raise
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="catalog.product.image.create",
        entity_type="product_image",
        entity_id=result.id,
        after={"product_id": product_id, "url": result.url},
        request=request,
    )
    return result


@router.get("/rfqs", response_model=AdminRFQListResponse)
async def list_rfqs(
    db: DatabaseSession,
    current_user: RfqViewer,
    status: RFQStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=128),
) -> AdminRFQListResponse:
    return await AdminService(db).list_rfqs(status=status, search=search)


@router.post("/rfqs/{rfq_id}/quote", response_model=B2BRFQResponse)
async def quote_rfq(
    rfq_id: int,
    payload: IssueQuoteRequest,
    db: DatabaseSession,
    current_user: RfqQuoter,
) -> B2BRFQResponse:
    return await B2BService(db).issue_quote(rfq_id=rfq_id, payload=payload)


@router.get("/rmas", response_model=AdminRMAListResponse)
async def list_rmas(
    db: DatabaseSession,
    current_user: SupportViewer,
    status: RMAStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=128),
) -> AdminRMAListResponse:
    return await AdminService(db).list_rmas(status=status, search=search)


@router.post("/rmas/{rma_id}/review", response_model=AdminRMAItem)
async def review_rma(
    rma_id: int,
    payload: RMAReviewRequest,
    request: Request,
    db: DatabaseSession,
    current_user: SupportManager,
) -> AdminRMAItem:
    return await AdminService(db).review_rma(
        rma_id=rma_id,
        payload=payload,
        actor=current_user,
        request=request,
    )


@router.get("/shipments", response_model=AdminShipmentListResponse)
async def list_shipments(
    db: DatabaseSession,
    current_user: ShipmentViewer,
    search: str | None = Query(default=None, max_length=128),
) -> AdminShipmentListResponse:
    return await AdminService(db).list_shipments(search=search)


@router.post("/shipments/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    payload: DispatchOrderRequest,
    request: Request,
    db: DatabaseSession,
    current_user: ShipmentDispatcher,
) -> DispatchOrderResponse:
    result = await ShippingService(db).dispatch(order_id, payload)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="shipment.dispatch",
        entity_type="sale_order",
        entity_id=order_id,
        after=result,
        request=request,
    )
    return result


@router.get("/stock", response_model=AdminProductListResponse)
async def list_stock(
    db: DatabaseSession,
    current_user: InventoryViewer,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    search: str | None = Query(default=None, max_length=128),
) -> AdminProductListResponse:
    return await AdminService(db).list_products(page=page, limit=limit, search=search)


@router.post("/stock/adjust", response_model=AdminStockAdjustmentResponse)
async def adjust_stock(
    payload: AdminStockAdjustmentRequest,
    request: Request,
    db: DatabaseSession,
    current_user: InventoryAdjuster,
) -> AdminStockAdjustmentResponse:
    return await AdminService(db).adjust_stock(payload=payload, actor=current_user, request=request)

"""HTTP boundary for the role-protected staff administration console."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.admin.schemas import (
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminDashboardResponse,
    AdminOrderDetail,
    AdminOrderListResponse,
    AdminOrderStateUpdateRequest,
    AdminProductListResponse,
    AdminRFQListResponse,
    AdminRMAItem,
    AdminRMAListResponse,
    AdminShipmentListResponse,
    AdminStockAdjustmentRequest,
    AdminStockAdjustmentResponse,
)
from app.modules.admin.service import AdminService
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
from app.shared.schemas import (
    OrderState,
    PaymentStatus,
    RFQStatus,
    RMAStatus,
    UserRole,
)
from app.shared.security import require_role

router = APIRouter()
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]

StaffUser = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.FINANCE_OFFICER,
            UserRole.INVENTORY_MANAGER,
            UserRole.WAREHOUSE_OPERATOR,
            UserRole.CUSTOMER_SUPPORT,
        )
    ),
]
OrderStaff = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.FINANCE_OFFICER,
            UserRole.WAREHOUSE_OPERATOR,
            UserRole.CUSTOMER_SUPPORT,
        )
    ),
]
InventoryStaff = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.INVENTORY_MANAGER,
            UserRole.WAREHOUSE_OPERATOR,
        )
    ),
]
InventoryManager = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.INVENTORY_MANAGER)),
]
SystemAdmin = Annotated[dict, Depends(require_role(UserRole.SYSTEM_ADMIN))]
CustomerStaff = Annotated[
    dict,
    Depends(
        require_role(
            UserRole.SYSTEM_ADMIN,
            UserRole.CUSTOMER_SUPPORT,
            UserRole.FINANCE_OFFICER,
        )
    ),
]
SupportStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.CUSTOMER_SUPPORT)),
]
FinanceStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.FINANCE_OFFICER)),
]
WarehouseStaff = Annotated[
    dict,
    Depends(require_role(UserRole.SYSTEM_ADMIN, UserRole.WAREHOUSE_OPERATOR)),
]


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_dashboard(db: DatabaseSession, current_user: StaffUser) -> AdminDashboardResponse:
    return await AdminService(db).dashboard()


@router.get("/orders", response_model=AdminOrderListResponse)
async def list_orders(
    db: DatabaseSession,
    current_user: OrderStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: Annotated[OrderState | None, Query()] = None,
    payment_status: Annotated[PaymentStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminOrderListResponse:
    return await AdminService(db).list_orders(
        page=page,
        limit=limit,
        state=state,
        payment_status=payment_status,
        query=q,
    )


@router.get("/orders/{order_id}", response_model=AdminOrderDetail)
async def get_order(order_id: int, db: DatabaseSession, current_user: OrderStaff) -> AdminOrderDetail:
    return await AdminService(db).get_order(order_id)


@router.put("/orders/{order_id}/state", response_model=AdminOrderDetail)
async def update_order_state(
    order_id: int,
    request: AdminOrderStateUpdateRequest,
    db: DatabaseSession,
    current_user: WarehouseStaff,
) -> AdminOrderDetail:
    return await AdminService(db).update_order_state(order_id, request.state)


@router.get("/products", response_model=AdminProductListResponse)
async def list_products(
    db: DatabaseSession,
    current_user: InventoryStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    q: str | None = Query(default=None, min_length=1, max_length=128),
    low_stock: bool = Query(default=False),
    active: bool | None = Query(default=None),
) -> AdminProductListResponse:
    return await AdminService(db).list_products(
        page=page,
        limit=limit,
        query=q,
        low_stock_only=low_stock,
        active=active,
    )


@router.get("/products/categories")
async def list_product_categories(db: DatabaseSession, current_user: InventoryStaff):
    return await ProductService(db).get_category_tree(include_inactive=True)


@router.get("/products/{product_id}", response_model=ProductDetailResponse)
async def get_admin_product(
    product_id: int,
    db: DatabaseSession,
    current_user: InventoryStaff,
) -> ProductDetailResponse:
    return await ProductService(db).get_product_detail(product_id, include_inactive=True)


@router.post("/products", response_model=ProductDetailResponse, status_code=201)
async def create_admin_product(
    request: ProductCreateRequest,
    db: DatabaseSession,
    current_user: InventoryManager,
) -> ProductDetailResponse:
    return await ProductService(db).create_product(request)


@router.put("/products/{product_id}", response_model=ProductDetailResponse)
async def update_admin_product(
    product_id: int,
    request: ProductUpdateRequest,
    db: DatabaseSession,
    current_user: InventoryManager,
) -> ProductDetailResponse:
    return await ProductService(db).update_product(product_id, request)


@router.delete("/products/{product_id}", status_code=204)
async def archive_admin_product(
    product_id: int,
    db: DatabaseSession,
    current_user: SystemAdmin,
):
    await ProductService(db).delete_product(product_id)
    return None


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=201,
)
async def upload_admin_product_image(
    product_id: int,
    db: DatabaseSession,
    current_user: InventoryManager,
    image: UploadFile = File(...),
    alt_text: str | None = Form(default=None, max_length=255),
    is_primary: bool = Form(default=False),
) -> ProductImageResponse:
    product = await ProductService(db).get_product_detail(product_id, include_inactive=True)
    url = await store_product_image(image, product_id)
    try:
        return await ProductService(db).add_product_image(
            product_id,
            url=url,
            alt_text=alt_text or product.name,
            is_primary=is_primary,
        )
    except Exception:
        delete_product_image_file(url)
        raise


@router.delete("/products/{product_id}/images/{image_id}", status_code=204)
async def delete_admin_product_image(
    product_id: int,
    image_id: int,
    db: DatabaseSession,
    current_user: InventoryManager,
):
    url = await ProductService(db).delete_product_image(product_id, image_id)
    delete_product_image_file(url)
    return None


@router.post(
    "/products/{product_id}/stock-adjustments",
    response_model=AdminStockAdjustmentResponse,
)
async def adjust_product_stock(
    product_id: int,
    request: AdminStockAdjustmentRequest,
    db: DatabaseSession,
    current_user: InventoryManager,
) -> AdminStockAdjustmentResponse:
    return await AdminService(db).adjust_product_stock(product_id, request)


@router.get("/customers", response_model=AdminCustomerListResponse)
async def list_customers(
    db: DatabaseSession,
    current_user: CustomerStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    q: str | None = Query(default=None, min_length=1, max_length=128),
    active: bool | None = Query(default=None),
) -> AdminCustomerListResponse:
    return await AdminService(db).list_customers(page=page, limit=limit, query=q, active=active)


@router.get("/customers/{customer_id}", response_model=AdminCustomerDetail)
async def get_customer(
    customer_id: int,
    db: DatabaseSession,
    current_user: CustomerStaff,
) -> AdminCustomerDetail:
    return await AdminService(db).get_customer(customer_id)


@router.get("/rma", response_model=AdminRMAListResponse)
async def list_rmas(
    db: DatabaseSession,
    current_user: SupportStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RMAStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRMAListResponse:
    return await AdminService(db).list_rmas(page=page, limit=limit, status=status, query=q)


@router.put("/rma/{ticket_number}/review", response_model=AdminRMAItem)
async def review_rma(
    ticket_number: str,
    request: RMAReviewRequest,
    db: DatabaseSession,
    current_user: SupportStaff,
) -> AdminRMAItem:
    return await AdminService(db).review_rma(ticket_number, current_user["user_id"], request)


@router.get("/rfqs", response_model=AdminRFQListResponse)
async def list_rfqs(
    db: DatabaseSession,
    current_user: FinanceStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Annotated[RFQStatus | None, Query()] = None,
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminRFQListResponse:
    return await AdminService(db).list_rfqs(page=page, limit=limit, status=status, query=q)


@router.put("/rfqs/{rfq_code}/quote", response_model=B2BRFQResponse)
async def issue_rfq_quote(
    rfq_code: str,
    request: IssueQuoteRequest,
    db: DatabaseSession,
    current_user: FinanceStaff,
) -> B2BRFQResponse:
    return await B2BService(db).issue_quote(rfq_code, request, current_user)


@router.get("/shipments", response_model=AdminShipmentListResponse)
async def list_shipments(
    db: DatabaseSession,
    current_user: WarehouseStaff,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    state: str | None = Query(default=None, min_length=1, max_length=32),
    q: str | None = Query(default=None, min_length=1, max_length=128),
) -> AdminShipmentListResponse:
    return await AdminService(db).list_shipments(page=page, limit=limit, state=state, query=q)


@router.post("/shipments/{order_id}/dispatch", response_model=DispatchOrderResponse)
async def dispatch_order(
    order_id: int,
    request: DispatchOrderRequest,
    db: DatabaseSession,
    current_user: WarehouseStaff,
) -> DispatchOrderResponse:
    return await ShippingService(db).dispatch_order(order_id, request)

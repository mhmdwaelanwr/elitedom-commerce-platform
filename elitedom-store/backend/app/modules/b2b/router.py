"""HTTP endpoints for institutional RFQs, quotations, and B2B order conversion."""

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.b2b.schemas import (
    B2BRFQListResponse,
    B2BRFQResponse,
    ConvertRFQRequest,
    IssueQuoteRequest,
    RFQConversionResponse,
    SubmitRFQRequest,
)
from app.modules.b2b.service import B2BService
from app.shared.schemas import RFQStatus, UserRole
from app.shared.security import require_role

router = APIRouter()


@router.post("/rfq", response_model=B2BRFQResponse, status_code=201)
async def submit_rfq(
    request: SubmitRFQRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.B2B_CLIENT, UserRole.SYSTEM_ADMIN)),
):
    """
    Submit a bulk quotation request.

    FR-B2B-001: only active B2B partner records may own an RFQ. Administrators
    may submit on behalf of a B2B partner by supplying ``partner_id``.
    """
    return await B2BService(db).submit_rfq(request, current_user)


@router.get("/rfq", response_model=B2BRFQListResponse)
async def list_rfqs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: RFQStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.B2B_CLIENT,
            UserRole.FINANCE_OFFICER,
            UserRole.SYSTEM_ADMIN,
        )
    ),
):
    """List the caller's RFQs, or all RFQs for Finance/Admin users."""
    return await B2BService(db).list_rfqs(
        current_user,
        page=page,
        limit=limit,
        status_filter=status_filter,
    )


@router.get("/rfq/{rfq_code}", response_model=B2BRFQResponse)
async def get_rfq(
    rfq_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.B2B_CLIENT,
            UserRole.FINANCE_OFFICER,
            UserRole.SYSTEM_ADMIN,
        )
    ),
):
    """Get RFQ details and the issued pricing proposal when authorized."""
    return await B2BService(db).get_rfq(rfq_code, current_user)


@router.put("/rfq/{rfq_code}/quote", response_model=B2BRFQResponse)
async def issue_quote(
    rfq_code: str,
    request: IssueQuoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.FINANCE_OFFICER, UserRole.SYSTEM_ADMIN)),
):
    """
    Issue a tiered pricing proposal for an RFQ.

    FR-B2B-002: Finance/Admin users can use the partner's tiered pricelist or
    safely override individual product prices/discounts.
    """
    return await B2BService(db).issue_quote(rfq_code, request, current_user)


@router.post("/rfq/{rfq_code}/convert", response_model=RFQConversionResponse)
async def convert_rfq_to_order(
    rfq_code: str,
    request: ConvertRFQRequest | None = None,
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        max_length=128,
    ),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.B2B_CLIENT,
            UserRole.FINANCE_OFFICER,
            UserRole.SYSTEM_ADMIN,
        )
    ),
):
    """
    Convert one accepted B2B quote to an order exactly once.

    The RFQ owner may accept their own quote; Finance/Admin users may convert
    any quote. Repeated calls return the original order instead of duplicating
    order lines or decrementing stock a second time.
    """
    return await B2BService(db).convert_rfq_to_order(
        rfq_code,
        request or ConvertRFQRequest(),
        current_user,
        header_idempotency_key=idempotency_key,
    )

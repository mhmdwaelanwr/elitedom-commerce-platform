"""HTTP endpoints for institutional RFQs, quotations, and B2B order conversion."""

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Partner
from app.modules.admin.access import AdminPermission
from app.modules.admin.access_service import AdminAccessService
from app.modules.b2b.procurement import (
    hydrate_rfq_list,
    hydrate_rfq_response,
    persist_procurement_snapshot,
)
from app.modules.b2b.schemas import (
    B2BRFQListResponse,
    B2BRFQResponse,
    ConvertRFQRequest,
    IssueQuoteRequest,
    RFQConversionResponse,
    SubmitRFQRequest,
)
from app.modules.b2b.service import B2BService
from app.shared.exceptions import InsufficientPermissionsError
from app.shared.schemas import RFQStatus, UserRole
from app.shared.security import get_current_user, require_staff_access

router = APIRouter()


def require_b2b_or_permission(permission: AdminPermission):
    """Allow a current B2B client or staff with a current database-backed permission."""

    async def checker(
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        persisted_role = await db.scalar(
            select(Partner.role).where(
                Partner.id == current_user["user_id"],
                Partner.is_active.is_(True),
            )
        )
        if persisted_role == UserRole.B2B_CLIENT.value:
            return {**current_user, "role": persisted_role}
        role, permissions = await require_staff_access(
            db=db,
            current_user=current_user,
            permissions=(permission.value,),
        )
        return {**current_user, "role": role, "permissions": sorted(permissions)}

    return checker


@router.post("/rfq", response_model=B2BRFQResponse, status_code=201)
async def submit_rfq(
    payload: SubmitRFQRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_b2b_or_permission(AdminPermission.RFQ_QUOTE)),
):
    result = await B2BService(db).submit_rfq(payload, current_user)
    result = await persist_procurement_snapshot(
        db,
        rfq=result,
        procurement=payload.procurement,
    )
    if current_user.get("role") != UserRole.B2B_CLIENT.value:
        await AdminAccessService(db).record_audit(
            actor=current_user,
            action="rfq.submit_on_behalf",
            entity_type="rfq",
            entity_id=result.rfq_code,
            after=result,
            request=request,
        )
    return result


@router.get("/rfq", response_model=B2BRFQListResponse)
async def list_rfqs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: RFQStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_b2b_or_permission(AdminPermission.RFQ_VIEW)),
):
    result = await B2BService(db).list_rfqs(
        current_user,
        page=page,
        limit=limit,
        status_filter=status_filter,
    )
    return await hydrate_rfq_list(db, result)


@router.get("/rfq/{rfq_code}", response_model=B2BRFQResponse)
async def get_rfq(
    rfq_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_b2b_or_permission(AdminPermission.RFQ_VIEW)),
):
    result = await B2BService(db).get_rfq(rfq_code, current_user)
    return await hydrate_rfq_response(db, result)


@router.put("/rfq/{rfq_code}/quote", response_model=B2BRFQResponse)
async def issue_quote(
    rfq_code: str,
    payload: IssueQuoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_b2b_or_permission(AdminPermission.RFQ_QUOTE)),
):
    if current_user.get("role") == UserRole.B2B_CLIENT.value:
        raise InsufficientPermissionsError()
    result = await B2BService(db).issue_quote(rfq_code, payload, current_user)
    result = await hydrate_rfq_response(db, result)
    await AdminAccessService(db).record_audit(
        actor=current_user,
        action="rfq.quote.issue",
        entity_type="rfq",
        entity_id=rfq_code,
        after=result,
        request=request,
    )
    return result


@router.post("/rfq/{rfq_code}/convert", response_model=RFQConversionResponse)
async def convert_rfq_to_order(
    rfq_code: str,
    request: Request,
    payload: ConvertRFQRequest | None = None,
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        max_length=128,
    ),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_b2b_or_permission(AdminPermission.RFQ_QUOTE)),
):
    result = await B2BService(db).convert_rfq_to_order(
        rfq_code,
        payload or ConvertRFQRequest(),
        current_user,
        header_idempotency_key=idempotency_key,
    )
    if current_user.get("role") != UserRole.B2B_CLIENT.value:
        await AdminAccessService(db).record_audit(
            actor=current_user,
            action="rfq.convert",
            entity_type="rfq",
            entity_id=rfq_code,
            after=result,
            request=request,
        )
    return result

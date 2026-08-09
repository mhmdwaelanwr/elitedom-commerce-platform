"""Persistence helpers for the commercial context attached to a B2B RFQ.

The initial RFQ table already owns a versioned JSON payload. Procurement fields
are additive presentation/workflow metadata, so keeping them in that payload
avoids a schema migration while preserving the typed API boundary.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import B2BRFQ, Partner
from app.modules.b2b.schemas import (
    B2BRFQListResponse,
    B2BRFQResponse,
    ProcurementDetailsRequest,
    ProcurementDetailsResponse,
)
from app.shared.exceptions import ResourceConflictError, ResourceNotFoundError


async def persist_procurement_snapshot(
    db: AsyncSession,
    *,
    rfq: B2BRFQResponse,
    procurement: ProcurementDetailsRequest | None,
) -> B2BRFQResponse:
    """Persist buyer-supplied context plus an identity snapshot and return it."""
    if procurement is None:
        return rfq

    row = await db.scalar(select(B2BRFQ).where(B2BRFQ.id == rfq.id))
    if row is None:
        raise ResourceNotFoundError("B2BRFQ", rfq.id)
    partner = await db.scalar(select(Partner).where(Partner.id == rfq.partner_id))
    if partner is None:
        raise ResourceNotFoundError("Partner", rfq.partner_id)
    if not isinstance(row.items_payload, dict):
        raise ResourceConflictError(f"RFQ '{rfq.rfq_code}' contains an invalid items payload.")

    details = ProcurementDetailsResponse(
        title=procurement.title,
        company_name=partner.name,
        contact_name=partner.name,
        contact_email=partner.email,
        contact_phone=partner.phone,
        needed_by=procurement.needed_by,
        delivery_location=procurement.delivery_location or partner.governorate,
        budget_target=procurement.budget_target,
        payment_terms=procurement.payment_terms,
    )
    payload = deepcopy(row.items_payload)
    payload["schema_version"] = max(int(payload.get("schema_version") or 1), 2)
    payload["procurement"] = _details_to_json(details)
    row.items_payload = payload
    await db.flush()
    return rfq.model_copy(update={"procurement": details})


async def hydrate_rfq_response(db: AsyncSession, rfq: B2BRFQResponse) -> B2BRFQResponse:
    row = await db.scalar(select(B2BRFQ).where(B2BRFQ.id == rfq.id))
    if row is None or not isinstance(row.items_payload, dict):
        return rfq
    details = _details_from_json(row.items_payload.get("procurement"))
    return rfq.model_copy(update={"procurement": details})


async def hydrate_rfq_list(
    db: AsyncSession,
    response: B2BRFQListResponse,
) -> B2BRFQListResponse:
    if not response.rfqs:
        return response
    ids = [rfq.id for rfq in response.rfqs]
    rows = (
        await db.execute(select(B2BRFQ.id, B2BRFQ.items_payload).where(B2BRFQ.id.in_(ids)))
    ).all()
    payloads = {row_id: payload for row_id, payload in rows}
    hydrated = []
    for rfq in response.rfqs:
        payload = payloads.get(rfq.id)
        details = _details_from_json(payload.get("procurement")) if isinstance(payload, dict) else None
        hydrated.append(rfq.model_copy(update={"procurement": details}))
    return response.model_copy(update={"rfqs": hydrated})


def _details_to_json(details: ProcurementDetailsResponse) -> dict[str, Any]:
    return {
        "title": details.title,
        "company_name": details.company_name,
        "contact_name": details.contact_name,
        "contact_email": details.contact_email,
        "contact_phone": details.contact_phone,
        "needed_by": details.needed_by.isoformat() if details.needed_by else None,
        "delivery_location": details.delivery_location,
        "budget_target": format(details.budget_target, "f") if details.budget_target is not None else None,
        "payment_terms": details.payment_terms,
    }


def _details_from_json(raw: Any) -> ProcurementDetailsResponse | None:
    if not isinstance(raw, dict):
        return None
    return ProcurementDetailsResponse(
        title=_text(raw.get("title")),
        company_name=_text(raw.get("company_name")),
        contact_name=_text(raw.get("contact_name")),
        contact_email=_text(raw.get("contact_email")),
        contact_phone=_text(raw.get("contact_phone")),
        needed_by=_date(raw.get("needed_by")),
        delivery_location=_text(raw.get("delivery_location")),
        budget_target=_decimal(raw.get("budget_target")),
        payment_terms=_text(raw.get("payment_terms")),
    )


def _text(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() and parsed >= 0 else None

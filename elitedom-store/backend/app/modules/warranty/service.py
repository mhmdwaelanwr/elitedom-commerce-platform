"""
Elitedom Store — Warranty & RMA Module Service.

The warranty context owns eligibility checks and the RMA review state machine.
The router is deliberately kept thin so the same rules can be used by a future
Typeform/Odoo intake adapter without bypassing ownership or serial validation.
"""

from datetime import date, datetime
from urllib.parse import urlparse
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ProductTemplate, RMATicket, SaleOrder, StockLot
from app.shared.events import WarrantyClaimSubmitted
from app.shared.exceptions import (
    InsufficientPermissionsError,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import OrderState, RMAStatus


class RMASubmitRequest(BaseModel):
    """Customer supplied evidence for a warranty or return claim."""

    order_id: int = Field(..., ge=1)
    product_id: int = Field(..., ge=1)
    serial_number: str | None = Field(default=None, min_length=2, max_length=128)
    reason: str = Field(..., min_length=10, max_length=1000)
    evidence_media_url: str = Field(..., min_length=8, max_length=512)

    @field_validator("serial_number", "reason", "evidence_media_url")
    @classmethod
    def strip_text_values(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank.")
        return value

    @field_validator("evidence_media_url")
    @classmethod
    def validate_evidence_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("evidence_media_url must be an absolute HTTP(S) URL.")
        return value


class RMAReviewRequest(BaseModel):
    """Support-agent decision for a pending RMA ticket."""

    status: RMAStatus
    resolution_notes: str | None = Field(default=None, max_length=2000)

    @field_validator("resolution_notes")
    @classmethod
    def strip_resolution_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_review_target(self) -> "RMAReviewRequest":
        if self.status == RMAStatus.PENDING_REVIEW:
            raise ValueError("A review must move the claim out of pending_review.")
        if self.status == RMAStatus.REJECTED and not self.resolution_notes:
            raise ValueError("resolution_notes are required when rejecting an RMA claim.")
        return self


class RMATicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_number: str
    partner_id: int
    order_id: int
    product_id: int
    serial_number: str | None = None
    status: RMAStatus
    reason: str
    evidence_media_url: str | None = None
    resolution_notes: str | None = None
    resolved_by: int | None = None
    created_at: datetime
    updated_at: datetime | None = None


class RMASubmitResponse(RMATicketResponse):
    """Response returned after automated warranty intake succeeds."""


class RMAListResponse(BaseModel):
    claims: list[RMATicketResponse]
    total_count: int
    page: int
    limit: int


class WarrantyCheckResponse(BaseModel):
    serial_number: str
    product_id: int
    is_valid: bool
    warranty_expiration_date: date | None = None


_RMA_TRANSITIONS: dict[RMAStatus, set[RMAStatus]] = {
    RMAStatus.PENDING_REVIEW: {RMAStatus.APPROVED, RMAStatus.REJECTED},
    RMAStatus.APPROVED: {RMAStatus.COMPLETED},
    RMAStatus.REJECTED: set(),
    RMAStatus.COMPLETED: set(),
}


class WarrantyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def submit_claim(self, partner_id: int, request: RMASubmitRequest) -> RMASubmitResponse:
        """
        Submit an RMA claim after validating the purchaser, order line, serial,
        and warranty window (FR-RMA-001/002).
        """
        order = await self._get_owned_order(partner_id, request.order_id)
        if order.state != OrderState.DONE.value:
            raise ResourceConflictError("RMA claims can only be submitted for completed orders.")

        product = await self._validate_order_product(order, request.product_id)
        warranty_expiration = self._warranty_expiration_for_order(order, product)

        if request.serial_number:
            lot = await self._get_lot(request.serial_number)
            self._validate_lot_matches_claim(lot, request)
            warranty_expiration = self._warranty_expiration_for_lot(lot, order, product)
        elif product.tracking == "serial":
            raise ResourceConflictError("A serial number is required for serial-tracked products.")

        if warranty_expiration is None:
            raise ResourceConflictError(
                "Warranty eligibility cannot be determined for this order item."
            )
        if warranty_expiration < date.today():
            raise ResourceConflictError(f"Warranty expired on {warranty_expiration}.")

        active_claim = await self.db.execute(
            select(RMATicket.id).where(
                RMATicket.partner_id == partner_id,
                RMATicket.order_id == request.order_id,
                RMATicket.product_id == request.product_id,
                RMATicket.serial_number == request.serial_number,
                RMATicket.status.in_([RMAStatus.PENDING_REVIEW.value, RMAStatus.APPROVED.value]),
            )
        )
        if active_claim.scalar_one_or_none() is not None:
            raise ResourceConflictError("An active RMA claim already exists for this order item.")

        ticket = RMATicket(
            ticket_number=self._new_ticket_number(),
            partner_id=partner_id,
            order_id=request.order_id,
            product_id=request.product_id,
            serial_number=request.serial_number,
            reason=request.reason,
            evidence_media_url=request.evidence_media_url,
            status=RMAStatus.PENDING_REVIEW.value,
        )
        self.db.add(ticket)
        await self.db.flush()

        await publish_domain_event(
            self.db,
            WarrantyClaimSubmitted(
                payload={
                    "ticket_id": ticket.id,
                    "ticket_number": ticket.ticket_number,
                    "partner_id": partner_id,
                }
            ),
        )

        return RMASubmitResponse.model_validate(ticket)

    async def list_claims(
        self,
        requester_id: int,
        *,
        include_all: bool,
        page: int,
        limit: int,
        status: RMAStatus | None = None,
    ) -> RMAListResponse:
        """List the caller's claims, or all claims for authorised support staff."""
        filters = []
        if not include_all:
            filters.append(RMATicket.partner_id == requester_id)
        if status is not None:
            filters.append(RMATicket.status == status.value)

        count_query = select(func.count()).select_from(RMATicket)
        if filters:
            count_query = count_query.where(*filters)
        total_count = (await self.db.execute(count_query)).scalar_one()

        query = (
            select(RMATicket)
            .where(*filters)
            .order_by(RMATicket.created_at.desc(), RMATicket.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        claims = (await self.db.execute(query)).scalars().all()
        return RMAListResponse(
            claims=[RMATicketResponse.model_validate(claim) for claim in claims],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def get_claim(
        self, ticket_number: str, requester_id: int, *, include_all: bool
    ) -> RMATicketResponse:
        """Load a ticket while enforcing object-level access control."""
        ticket = await self._get_ticket(ticket_number)
        if not include_all and ticket.partner_id != requester_id:
            raise InsufficientPermissionsError()
        return RMATicketResponse.model_validate(ticket)

    async def review_claim(
        self,
        ticket_number: str,
        reviewer_id: int,
        request: RMAReviewRequest,
    ) -> RMATicketResponse:
        """Apply a valid Level-2 support review transition to an RMA ticket."""
        ticket = await self._get_ticket(ticket_number)
        current_status = RMAStatus(ticket.status)
        if request.status not in _RMA_TRANSITIONS[current_status]:
            raise ResourceConflictError(
                f"Cannot transition RMA claim from '{current_status.value}' "
                f"to '{request.status.value}'."
            )

        ticket.status = request.status.value
        ticket.resolution_notes = request.resolution_notes
        ticket.resolved_by = reviewer_id
        await self.db.flush()
        # ``updated_at`` is populated by the database on update. Refresh it
        # before serializing so async SQLAlchemy never attempts a lazy load
        # outside its greenlet context.
        await self.db.refresh(ticket)
        return RMATicketResponse.model_validate(ticket)

    async def check_warranty(
        self,
        serial_number: str,
        requester_id: int,
        *,
        include_all: bool,
    ) -> WarrantyCheckResponse:
        """Return a serial's warranty validity without exposing another user's asset."""
        lot = await self._get_lot(serial_number)
        if not include_all:
            if lot.sale_order_id is None:
                raise InsufficientPermissionsError()
            sale_order = await self._get_order(lot.sale_order_id)
            if sale_order.partner_id != requester_id:
                raise InsufficientPermissionsError()
        else:
            sale_order = (
                await self._get_order(lot.sale_order_id) if lot.sale_order_id is not None else None
            )

        product = await self._get_product(lot.product_id)
        expiration = self._warranty_expiration_for_lot(lot, sale_order, product)
        return WarrantyCheckResponse(
            serial_number=lot.name,
            product_id=lot.product_id,
            is_valid=expiration is not None and expiration >= date.today(),
            warranty_expiration_date=expiration,
        )

    async def _get_owned_order(self, partner_id: int, order_id: int) -> SaleOrder:
        result = await self.db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id, SaleOrder.partner_id == partner_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)
        return order

    async def _get_order(self, order_id: int) -> SaleOrder:
        result = await self.db.execute(select(SaleOrder).where(SaleOrder.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceNotFoundError("SaleOrder", order_id)
        return order

    async def _get_product(self, product_id: int) -> ProductTemplate:
        result = await self.db.execute(
            select(ProductTemplate).where(ProductTemplate.id == product_id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise ResourceNotFoundError("Product", product_id)
        return product

    async def _get_lot(self, serial_number: str) -> StockLot:
        result = await self.db.execute(select(StockLot).where(StockLot.name == serial_number))
        lot = result.scalar_one_or_none()
        if not lot:
            raise ResourceNotFoundError("SerialNumber", serial_number)
        return lot

    async def _get_ticket(self, ticket_number: str) -> RMATicket:
        result = await self.db.execute(
            select(RMATicket).where(RMATicket.ticket_number == ticket_number)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise ResourceNotFoundError("RMATicket", ticket_number)
        return ticket

    async def _validate_order_product(self, order: SaleOrder, product_id: int) -> ProductTemplate:
        if not any(line.product_id == product_id for line in order.order_lines):
            raise ResourceConflictError("The requested product is not part of the selected order.")
        return await self._get_product(product_id)

    @staticmethod
    def _validate_lot_matches_claim(lot: StockLot, request: RMASubmitRequest) -> None:
        if lot.product_id != request.product_id:
            raise ResourceConflictError(
                "The serial number does not belong to the requested product."
            )
        if lot.sale_order_id != request.order_id:
            raise ResourceConflictError(
                "The serial number is not associated with the selected order."
            )

    @staticmethod
    def _warranty_expiration_for_order(order: SaleOrder, product: ProductTemplate) -> date | None:
        if product.warranty_months <= 0 or order.created_at is None:
            return None
        return order.created_at.date() + relativedelta(months=product.warranty_months)

    @classmethod
    def _warranty_expiration_for_lot(
        cls,
        lot: StockLot,
        sale_order: SaleOrder | None,
        product: ProductTemplate,
    ) -> date | None:
        if lot.warranty_expiration_date is not None:
            return lot.warranty_expiration_date
        if sale_order is None:
            return None
        return cls._warranty_expiration_for_order(sale_order, product)

    @staticmethod
    def _new_ticket_number() -> str:
        return f"RMA-{date.today().year}-{uuid4().hex[:8].upper()}"

"""Business logic for B2B RFQs, quotations, and quote conversion."""

from __future__ import annotations

import hashlib
from copy import deepcopy
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    B2BRFQ,
    Partner,
    PricelistItem,
    ProductTemplate,
    SaleOrder,
    SaleOrderLine,
)
from app.modules.b2b.schemas import (
    B2BRFQListResponse,
    B2BRFQResponse,
    B2BSaleOrderLineResponse,
    B2BSaleOrderResponse,
    ConvertRFQRequest,
    IssueQuoteRequest,
    QuoteDetailsResponse,
    QuoteItemRequest,
    RFQConversionResponse,
    RFQItemResponse,
    SubmitRFQRequest,
)
from app.shared.events import OrderCreated
from app.shared.exceptions import (
    InsufficientPermissionsError,
    InsufficientStockError,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.shared.outbox import publish_domain_event
from app.shared.schemas import RFQStatus, UserRole

MONEY_QUANTUM = Decimal("0.01")
STAFF_ROLES = {
    UserRole.FINANCE_OFFICER.value,
    UserRole.SYSTEM_ADMIN.value,
}
RFQ_CLIENT_ROLE = UserRole.B2B_CLIENT.value
QUOTEABLE_STATUSES = {
    RFQStatus.SUBMITTED.value,
    RFQStatus.UNDER_REVIEW.value,
    RFQStatus.QUOTED.value,
}


class B2BService:
    """Coordinates the B2B RFQ lifecycle without relying on raw JSON at the API edge."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── RFQ submission and retrieval ──────────────────────────────────────

    async def submit_rfq(
        self, request: SubmitRFQRequest, current_user: dict[str, Any]
    ) -> B2BRFQResponse:
        """Validate an institutional buyer's items and persist a new RFQ."""
        partner = await self._resolve_submission_partner(request, current_user)
        product_ids = [item.product_id for item in request.items]
        products = await self._load_active_products(product_ids)

        total_estimated_value = Decimal("0.00")
        serialized_items: list[dict[str, Any]] = []
        for item in request.items:
            product = products[item.product_id]
            list_price = self._money(product.list_price)
            total_estimated_value += list_price * item.quantity
            serialized_items.append(
                {
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "product_name": product.name,
                    "sku": product.sku,
                    # JSON columns cannot reliably serialize Decimal. Keep
                    # financial snapshots as fixed-point strings instead.
                    "list_price": self._decimal_to_json(list_price),
                }
            )

        rfq = B2BRFQ(
            rfq_code=self._new_reference("RFQ"),
            partner_id=partner.id,
            items_payload={"schema_version": 1, "items": serialized_items},
            status=RFQStatus.SUBMITTED.value,
            total_estimated_value=self._money(total_estimated_value),
            notes=request.notes,
        )
        self.db.add(rfq)
        await self.db.flush()
        # SQLite and PostgreSQL may populate audit timestamps on the server.
        # Reload before building a Pydantic response so async attribute access
        # never attempts an implicit database query outside greenlet context.
        await self.db.refresh(rfq)

        return self._rfq_response(rfq)

    async def list_rfqs(
        self,
        current_user: dict[str, Any],
        *,
        page: int,
        limit: int,
        status_filter: RFQStatus | None = None,
    ) -> B2BRFQListResponse:
        """List own RFQs for B2B clients and all RFQs for Finance/Admin staff."""
        user_id = self._current_user_id(current_user)
        query = select(B2BRFQ).order_by(B2BRFQ.created_at.desc())
        count_query = select(func.count()).select_from(B2BRFQ)

        if not self._is_staff(current_user):
            await self._require_active_b2b_partner(user_id)
            query = query.where(B2BRFQ.partner_id == user_id)
            count_query = count_query.where(B2BRFQ.partner_id == user_id)

        if status_filter is not None:
            query = query.where(B2BRFQ.status == status_filter.value)
            count_query = count_query.where(B2BRFQ.status == status_filter.value)

        total_count = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(query.offset((page - 1) * limit).limit(limit))
        rfqs = result.scalars().all()

        return B2BRFQListResponse(
            rfqs=[self._rfq_response(rfq) for rfq in rfqs],
            total_count=total_count,
            page=page,
            limit=limit,
        )

    async def get_rfq(self, rfq_code: str, current_user: dict[str, Any]) -> B2BRFQResponse:
        """Return an RFQ only to its B2B owner or authorized sales staff."""
        rfq = await self._find_rfq(rfq_code)
        await self._assert_rfq_access(rfq, current_user)
        return self._rfq_response(rfq)

    # ── Quote issuance ─────────────────────────────────────────────────────

    async def issue_quote(
        self,
        rfq_code: str,
        request: IssueQuoteRequest,
        current_user: dict[str, Any],
    ) -> B2BRFQResponse:
        """Apply corporate pricing and store a quote snapshot in the RFQ JSON payload."""
        self._require_staff_role(current_user)
        if request.validity_date < date.today():
            self._unprocessable("Quote validity_date cannot be in the past.")

        rfq = await self._find_rfq(rfq_code, lock=True)
        if rfq.status not in QUOTEABLE_STATUSES:
            raise ResourceConflictError(
                f"RFQ '{rfq.rfq_code}' cannot be quoted while its status is '{rfq.status}'."
            )

        partner = await self._require_active_b2b_partner(rfq.partner_id)
        payload = self._payload_for_update(rfq)
        requested_items = self._payload_items(payload)
        product_ids = [item["product_id"] for item in requested_items]
        products = await self._load_active_products(product_ids)
        quote_overrides = self._quote_overrides(request.items, requested_items)
        pricing_rules = await self._load_pricelist_rules(partner.pricelist_id, product_ids)

        total_quoted_value = Decimal("0.00")
        quoted_items: list[dict[str, Any]] = []
        for item in requested_items:
            product_id = item["product_id"]
            quantity = item["quantity"]
            product = products[product_id]
            list_price = self._money(product.list_price)
            override = quote_overrides.get(product_id)

            price, discount, pricing_source = self._quoted_price(
                product_id=product_id,
                quantity=quantity,
                list_price=list_price,
                override=override,
                pricing_rules=pricing_rules,
            )
            line_total = self._money(price * quantity)
            total_quoted_value += line_total

            quoted_items.append(
                {
                    "product_id": product_id,
                    "quantity": quantity,
                    "product_name": product.name,
                    "sku": product.sku,
                    "list_price": self._decimal_to_json(list_price),
                    "quoted_unit_price": self._decimal_to_json(price),
                    "discount_percent": self._decimal_to_json(discount),
                    "line_total": self._decimal_to_json(line_total),
                    "pricing_source": pricing_source,
                }
            )

        payload["items"] = quoted_items
        payload["quote"] = {
            "terms": request.terms,
            "currency": "EGP",
            "issued_at": datetime.now(UTC).isoformat(),
            "issued_by": self._current_user_id(current_user),
        }
        # A quote cannot have a conversion record until it is accepted. Removing
        # stale data here also makes a staff-issued revision unambiguous.
        payload.pop("conversion", None)

        rfq.items_payload = payload
        rfq.status = RFQStatus.QUOTED.value
        rfq.validity_date = request.validity_date
        rfq.total_estimated_value = self._money(total_quoted_value)
        await self.db.flush()
        # ``updated_at`` is maintained by the database.  Explicit refresh is
        # required before serializing an async SQLAlchemy model.
        await self.db.refresh(rfq)

        return self._rfq_response(rfq)

    # ── Quote conversion ───────────────────────────────────────────────────

    async def convert_rfq_to_order(
        self,
        rfq_code: str,
        request: ConvertRFQRequest,
        current_user: dict[str, Any],
        *,
        header_idempotency_key: str | None = None,
    ) -> RFQConversionResponse:
        """Atomically turn one quoted RFQ into exactly one confirmed sale order."""
        self._require_convert_role(current_user)
        idempotency_key = self._resolve_idempotency_key(
            request.idempotency_key, header_idempotency_key
        )

        # Locking the RFQ serializes concurrent conversion requests. PostgreSQL
        # honors this row lock; SQLite test environments safely ignore it.
        rfq = await self._find_rfq(rfq_code, lock=True)
        await self._assert_rfq_access(rfq, current_user)
        payload = self._payload_for_update(rfq)

        conversion = payload.get("conversion")
        if isinstance(conversion, dict):
            return await self._existing_conversion_response(rfq, conversion)

        if rfq.status != RFQStatus.QUOTED.value:
            raise ResourceConflictError(
                f"RFQ '{rfq.rfq_code}' must be quoted before it can be converted."
            )
        if rfq.validity_date is None or rfq.validity_date < date.today():
            raise ResourceConflictError(
                f"RFQ '{rfq.rfq_code}' has expired and cannot be converted."
            )

        partner = await self._require_active_b2b_partner(rfq.partner_id)
        quoted_items = self._quoted_payload_items(payload)
        product_ids = [item["product_id"] for item in quoted_items]
        products = await self._load_active_products(product_ids, lock=True)

        shipping_address = (request.shipping_address or partner.street_address or "").strip()
        if len(shipping_address) < 5:
            self._unprocessable(
                "A shipping_address is required either in the request or on the B2B account."
            )

        is_dropship_order = False
        subtotal = Decimal("0.00")
        for item in quoted_items:
            product = products[item["product_id"]]
            if product.is_dropship_enabled:
                is_dropship_order = True
            elif product.stock_qty < item["quantity"]:
                raise InsufficientStockError(product.sku, item["quantity"], product.stock_qty)
            subtotal += item["unit_price"] * item["quantity"]

        subtotal = self._money(subtotal)
        sale_order = SaleOrder(
            name=self._new_reference("SO-B2B"),
            partner_id=partner.id,
            # RFQ acceptance confirms the institutional order. Reserving local
            # stock in the same transaction prevents a later conversion from
            # overselling the validated inventory.
            state="sale",
            payment_method=request.payment_method.value,
            payment_status="pending",
            amount_subtotal=subtotal,
            amount_shipping=Decimal("0.00"),
            amount_tax=Decimal("0.00"),
            amount_total=subtotal,
            shipping_address=shipping_address,
            shipping_governorate=request.shipping_governorate or partner.governorate,
            is_dropship=is_dropship_order,
            notes=self._order_notes(rfq, request.notes),
        )
        self.db.add(sale_order)
        await self.db.flush()

        order_lines: list[SaleOrderLine] = []
        for item in quoted_items:
            product = products[item["product_id"]]
            line = SaleOrderLine(
                order_id=sale_order.id,
                product_id=product.id,
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                discount_percent=item["discount_percent"],
                line_total=self._money(item["unit_price"] * item["quantity"]),
            )
            self.db.add(line)
            order_lines.append(line)
            if not product.is_dropship_enabled:
                product.stock_qty -= item["quantity"]

        await self.db.flush()

        conversion_metadata: dict[str, Any] = {
            "order_id": sale_order.id,
            "order_number": sale_order.name,
            "converted_at": datetime.now(UTC).isoformat(),
            "converted_by": self._current_user_id(current_user),
        }
        if idempotency_key:
            conversion_metadata["idempotency_key_hash"] = hashlib.sha256(
                idempotency_key.encode("utf-8")
            ).hexdigest()

        payload["conversion"] = conversion_metadata
        rfq.items_payload = payload
        rfq.status = RFQStatus.ACCEPTED.value
        await self.db.flush()

        # Use the same domain integration boundary as storefront checkout so
        # Odoo/order-notification handlers can process B2B conversions too.
        await publish_domain_event(
            self.db,
            OrderCreated(
                payload={
                    "order_id": sale_order.id,
                    "order_number": sale_order.name,
                    "partner_id": partner.id,
                    "total_amount": float(sale_order.amount_total),
                    "source": "b2b_rfq",
                }
            ),
        )

        order_response = self._order_response(sale_order, order_lines)
        return RFQConversionResponse(
            rfq_code=rfq.rfq_code,
            status=RFQStatus.ACCEPTED,
            order_id=sale_order.id,
            order_number=sale_order.name,
            order=order_response,
        )

    # ── Authorization and database helpers ─────────────────────────────────

    async def _resolve_submission_partner(
        self, request: SubmitRFQRequest, current_user: dict[str, Any]
    ) -> Partner:
        user_id = self._current_user_id(current_user)
        if self._is_staff(current_user):
            partner_id = request.partner_id or user_id
            return await self._require_active_b2b_partner(partner_id)

        if self._role(current_user) != RFQ_CLIENT_ROLE:
            raise InsufficientPermissionsError()
        if request.partner_id is not None and request.partner_id != user_id:
            raise InsufficientPermissionsError()
        return await self._require_active_b2b_partner(user_id)

    async def _assert_rfq_access(self, rfq: B2BRFQ, current_user: dict[str, Any]) -> None:
        if self._is_staff(current_user):
            return
        if self._role(current_user) != RFQ_CLIENT_ROLE:
            raise InsufficientPermissionsError()

        user_id = self._current_user_id(current_user)
        await self._require_active_b2b_partner(user_id)
        if rfq.partner_id != user_id:
            raise InsufficientPermissionsError()

    async def _require_active_b2b_partner(self, partner_id: int) -> Partner:
        result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = result.scalar_one_or_none()
        if not partner:
            raise ResourceNotFoundError("Partner", partner_id)
        if not partner.is_active or partner.role != RFQ_CLIENT_ROLE:
            raise InsufficientPermissionsError()
        return partner

    async def _find_rfq(self, rfq_code: str, *, lock: bool = False) -> B2BRFQ:
        query = select(B2BRFQ).where(B2BRFQ.rfq_code == rfq_code)
        if lock:
            query = query.with_for_update()
        result = await self.db.execute(query)
        rfq = result.scalar_one_or_none()
        if not rfq:
            raise ResourceNotFoundError("B2B RFQ", rfq_code)
        return rfq

    async def _load_active_products(
        self, product_ids: list[int], *, lock: bool = False
    ) -> dict[int, ProductTemplate]:
        query = select(ProductTemplate).where(ProductTemplate.id.in_(product_ids))
        if lock:
            query = query.with_for_update()
        result = await self.db.execute(query)
        products = {product.id: product for product in result.scalars().all()}

        for product_id in product_ids:
            product = products.get(product_id)
            if not product or not product.is_active:
                raise ResourceNotFoundError("Product", product_id)
        return products

    async def _load_pricelist_rules(
        self, pricelist_id: int | None, product_ids: list[int]
    ) -> list[PricelistItem]:
        if pricelist_id is None:
            return []
        result = await self.db.execute(
            select(PricelistItem).where(
                PricelistItem.pricelist_id == pricelist_id,
                or_(
                    PricelistItem.product_id.in_(product_ids),
                    PricelistItem.product_id.is_(None),
                ),
            )
        )
        return result.scalars().all()

    # ── JSON payload management ────────────────────────────────────────────

    def _payload_for_update(self, rfq: B2BRFQ) -> dict[str, Any]:
        """Copy and validate JSON before editing it so JSON mutations are tracked."""
        if not isinstance(rfq.items_payload, dict):
            raise ResourceConflictError(f"RFQ '{rfq.rfq_code}' contains an invalid items payload.")
        payload = deepcopy(rfq.items_payload)
        self._payload_items(payload)
        return payload

    def _payload_items(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise ResourceConflictError("RFQ contains no valid line items.")

        items: list[dict[str, Any]] = []
        seen_products: set[int] = set()
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                raise ResourceConflictError("RFQ contains an invalid line item.")
            product_id = self._payload_positive_int(raw_item.get("product_id"), "product_id")
            quantity = self._payload_positive_int(raw_item.get("quantity"), "quantity")
            if product_id in seen_products:
                raise ResourceConflictError("RFQ contains duplicate product lines.")
            seen_products.add(product_id)
            item = dict(raw_item)
            item["product_id"] = product_id
            item["quantity"] = quantity
            items.append(item)
        return items

    def _quoted_payload_items(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        quoted_items: list[dict[str, Any]] = []
        for raw_item in self._payload_items(payload):
            try:
                unit_price = self._payload_money(
                    raw_item.get("quoted_unit_price"), "quoted_unit_price"
                )
                discount_percent = self._payload_money(
                    raw_item.get("discount_percent"), "discount_percent"
                )
            except ResourceConflictError as exc:
                raise ResourceConflictError(
                    "RFQ quote data is incomplete or invalid and cannot be converted."
                ) from exc
            if discount_percent < 0 or discount_percent > Decimal("100.00"):
                raise ResourceConflictError("RFQ quote contains an invalid discount.")
            raw_item["unit_price"] = unit_price
            raw_item["discount_percent"] = discount_percent
            quoted_items.append(raw_item)
        return quoted_items

    @staticmethod
    def _payload_positive_int(value: Any, field: str) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ResourceConflictError(f"RFQ contains an invalid {field}.")
        return value

    def _payload_money(self, value: Any, field: str) -> Decimal:
        if value is None:
            raise ResourceConflictError(f"RFQ contains no {field}.")
        try:
            parsed = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ResourceConflictError(f"RFQ contains an invalid {field}.") from None
        if not parsed.is_finite() or parsed < 0:
            raise ResourceConflictError(f"RFQ contains an invalid {field}.")
        return self._money(parsed)

    # ── Pricing ────────────────────────────────────────────────────────────

    def _quote_overrides(
        self,
        request_items: list[QuoteItemRequest] | None,
        requested_items: list[dict[str, Any]],
    ) -> dict[int, QuoteItemRequest]:
        if request_items is None:
            return {}

        requested_by_product = {item["product_id"]: item for item in requested_items}
        overrides: dict[int, QuoteItemRequest] = {}
        for item in request_items:
            requested = requested_by_product.get(item.product_id)
            if requested is None:
                self._unprocessable(
                    f"Product {item.product_id} is not present in the submitted RFQ."
                )
            if item.quantity is not None and item.quantity != requested["quantity"]:
                self._unprocessable(
                    "Quote line quantities must match the quantities in the submitted RFQ."
                )
            overrides[item.product_id] = item
        return overrides

    def _quoted_price(
        self,
        *,
        product_id: int,
        quantity: int,
        list_price: Decimal,
        override: QuoteItemRequest | None,
        pricing_rules: list[PricelistItem],
    ) -> tuple[Decimal, Decimal, str]:
        if override and override.unit_price is not None:
            unit_price = self._money(override.unit_price)
            if unit_price > list_price:
                self._unprocessable(
                    "Custom B2B unit_price may not exceed the current product list price."
                )
            return unit_price, self._effective_discount(list_price, unit_price), "custom_unit_price"

        if override and override.discount_percent is not None:
            discount = self._money(override.discount_percent)
            unit_price = self._money(list_price * (Decimal("100.00") - discount) / 100)
            return unit_price, discount, "custom_discount"

        discount = self._best_pricelist_discount(product_id, quantity, pricing_rules)
        unit_price = self._money(list_price * (Decimal("100.00") - discount) / 100)
        source = "pricelist" if discount > 0 else "list_price"
        return unit_price, discount, source

    def _best_pricelist_discount(
        self, product_id: int, quantity: int, pricing_rules: list[PricelistItem]
    ) -> Decimal:
        eligible: list[tuple[int, int, Decimal]] = []
        for rule in pricing_rules:
            if rule.product_id not in {None, product_id} or rule.min_quantity > quantity:
                continue
            discount = self._money(rule.discount_percent)
            if discount < 0 or discount > Decimal("100.00"):
                continue
            # Product-specific rules win over generic rules, followed by the
            # highest applicable quantity threshold and discount.
            eligible.append((int(rule.product_id == product_id), rule.min_quantity, discount))
        if not eligible:
            return Decimal("0.00")
        return max(eligible, key=lambda item: (item[0], item[1], item[2]))[2]

    def _effective_discount(self, list_price: Decimal, unit_price: Decimal) -> Decimal:
        if list_price == 0:
            return Decimal("0.00")
        return self._money((list_price - unit_price) * Decimal("100.00") / list_price)

    # ── Response serialization ─────────────────────────────────────────────

    def _rfq_response(self, rfq: B2BRFQ) -> B2BRFQResponse:
        payload = self._payload_for_update(rfq)
        items = [self._item_response(item) for item in self._payload_items(payload)]
        raw_quote = payload.get("quote")
        quote = self._quote_response(raw_quote) if isinstance(raw_quote, dict) else None

        return B2BRFQResponse(
            id=rfq.id,
            rfq_code=rfq.rfq_code,
            partner_id=rfq.partner_id,
            status=self._rfq_status(rfq.status),
            items=items,
            validity_date=rfq.validity_date,
            total_estimated_value=rfq.total_estimated_value,
            notes=rfq.notes,
            quote=quote,
            created_at=rfq.created_at,
            updated_at=rfq.updated_at,
        )

    def _item_response(self, item: dict[str, Any]) -> RFQItemResponse:
        return RFQItemResponse(
            product_id=item["product_id"],
            quantity=item["quantity"],
            product_name=(
                item.get("product_name") if isinstance(item.get("product_name"), str) else None
            ),
            sku=item.get("sku") if isinstance(item.get("sku"), str) else None,
            list_price=self._optional_payload_money(item.get("list_price"), "list_price"),
            quoted_unit_price=self._optional_payload_money(
                item.get("quoted_unit_price"), "quoted_unit_price"
            ),
            discount_percent=self._optional_payload_money(
                item.get("discount_percent"), "discount_percent"
            ),
            line_total=self._optional_payload_money(item.get("line_total"), "line_total"),
            pricing_source=item.get("pricing_source")
            if isinstance(item.get("pricing_source"), str)
            else None,
        )

    def _quote_response(self, quote: dict[str, Any]) -> QuoteDetailsResponse:
        issued_at: datetime | None = None
        raw_issued_at = quote.get("issued_at")
        if isinstance(raw_issued_at, str):
            try:
                issued_at = datetime.fromisoformat(raw_issued_at)
            except ValueError:
                issued_at = None

        issued_by = quote.get("issued_by")
        if isinstance(issued_by, bool) or not isinstance(issued_by, int):
            issued_by = None

        return QuoteDetailsResponse(
            terms=quote.get("terms") if isinstance(quote.get("terms"), str) else None,
            currency=quote.get("currency") if isinstance(quote.get("currency"), str) else "EGP",
            issued_at=issued_at,
            issued_by=issued_by,
        )

    async def _existing_conversion_response(
        self, rfq: B2BRFQ, conversion: dict[str, Any]
    ) -> RFQConversionResponse:
        order_id = conversion.get("order_id")
        if isinstance(order_id, bool) or not isinstance(order_id, int) or order_id < 1:
            raise ResourceConflictError(f"RFQ '{rfq.rfq_code}' has invalid conversion metadata.")
        result = await self.db.execute(
            select(SaleOrder)
            .options(selectinload(SaleOrder.order_lines))
            .where(SaleOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ResourceConflictError(
                f"RFQ '{rfq.rfq_code}' references an order that no longer exists."
            )
        return RFQConversionResponse(
            rfq_code=rfq.rfq_code,
            status=self._rfq_status(rfq.status),
            order_id=order.id,
            order_number=order.name,
            idempotent=True,
            order=self._order_response(order, list(order.order_lines)),
        )

    @staticmethod
    def _order_response(order: SaleOrder, order_lines: list[SaleOrderLine]) -> B2BSaleOrderResponse:
        return B2BSaleOrderResponse(
            id=order.id,
            name=order.name,
            partner_id=order.partner_id,
            state=order.state,
            payment_method=order.payment_method,
            payment_status=order.payment_status,
            amount_subtotal=order.amount_subtotal,
            amount_shipping=order.amount_shipping,
            amount_tax=order.amount_tax,
            amount_total=order.amount_total,
            shipping_address=order.shipping_address,
            shipping_governorate=order.shipping_governorate,
            is_dropship=order.is_dropship,
            notes=order.notes,
            created_at=order.created_at,
            order_lines=[
                B2BSaleOrderLineResponse(
                    id=line.id,
                    product_id=line.product_id,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    discount_percent=line.discount_percent,
                    line_total=line.line_total,
                )
                for line in order_lines
            ],
        )

    # ── Small validation helpers ───────────────────────────────────────────

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)

    def _optional_payload_money(self, value: Any, field: str) -> Decimal | None:
        return None if value is None else self._payload_money(value, field)

    def _decimal_to_json(self, value: Decimal) -> str:
        return format(self._money(value), "f")

    @staticmethod
    def _new_reference(prefix: str) -> str:
        return f"{prefix}-{date.today().year}-{uuid4().hex[:10].upper()}"

    @staticmethod
    def _order_notes(rfq: B2BRFQ, request_notes: str | None) -> str:
        notes = request_notes or rfq.notes
        return f"Created from B2B RFQ {rfq.rfq_code}." + (f" {notes}" if notes else "")

    @staticmethod
    def _rfq_status(value: str) -> RFQStatus:
        try:
            return RFQStatus(value)
        except ValueError:
            raise ResourceConflictError(f"RFQ contains an unknown status '{value}'.") from None

    @staticmethod
    def _role(current_user: dict[str, Any]) -> str:
        role = current_user.get("role")
        return role.value if isinstance(role, UserRole) else str(role)

    def _is_staff(self, current_user: dict[str, Any]) -> bool:
        return self._role(current_user) in STAFF_ROLES

    def _require_staff_role(self, current_user: dict[str, Any]) -> None:
        if not self._is_staff(current_user):
            raise InsufficientPermissionsError()

    def _require_convert_role(self, current_user: dict[str, Any]) -> None:
        if self._is_staff(current_user) or self._role(current_user) == RFQ_CLIENT_ROLE:
            return
        raise InsufficientPermissionsError()

    @staticmethod
    def _current_user_id(current_user: dict[str, Any]) -> int:
        user_id = current_user.get("user_id")
        try:
            parsed = int(user_id)
        except (TypeError, ValueError) as exc:
            raise InsufficientPermissionsError() from exc
        if parsed < 1:
            raise InsufficientPermissionsError()
        return parsed

    def _resolve_idempotency_key(self, body_key: str | None, header_key: str | None) -> str | None:
        normalized_header = header_key.strip() if header_key else None
        if normalized_header is not None and not 8 <= len(normalized_header) <= 128:
            self._unprocessable("Idempotency-Key must be between 8 and 128 characters.")
        if body_key and normalized_header and body_key != normalized_header:
            raise ResourceConflictError(
                "The request idempotency_key does not match the Idempotency-Key header."
            )
        return normalized_header or body_key

    @staticmethod
    def _unprocessable(detail: str) -> None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

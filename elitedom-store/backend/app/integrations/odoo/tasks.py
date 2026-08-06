"""Celery jobs for real, retryable Odoo synchronization.

The jobs intentionally return ``skipped`` when Odoo credentials have not been
configured.  They never report a remote update as successful without first
receiving a response from the Odoo XML-RPC API and committing the local change.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, time
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.config import get_settings
from app.integrations.odoo.client import odoo_client
from app.models import Currency, CurrencyRate, ProductTemplate, SaleOrder
from app.shared.events import InventoryUpdated
from app.shared.outbox import enqueue_domain_event_sync, request_outbox_dispatch

logger = logging.getLogger(__name__)
settings = get_settings()

PAGE_SIZE = 100


@contextmanager
def _sync_database_session() -> Iterator[Session]:
    """Use a short-lived synchronous session from a Celery worker process."""
    engine = create_engine(settings.database_url_sync, pool_pre_ping=True)
    session = Session(engine, expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


def _odoo_ready() -> bool:
    return bool(odoo_client.is_configured)


def _skipped(task_name: str) -> dict[str, str]:
    message = "Odoo credentials are not configured; no remote call was attempted."
    logger.warning("Skipping %s: %s", task_name, message)
    return {"status": "skipped", "reason": "odoo_not_configured", "task": task_name}


def _retry(task: Any, task_name: str, error: Exception) -> Any:
    """Retry integration failures with the documented 5s/15s/45s cadence."""
    retry_number = task.request.retries
    countdown = 5 * (3**retry_number)
    logger.exception(
        "Odoo task %s failed (attempt %s); retrying in %ss",
        task_name,
        retry_number + 1,
        countdown,
    )
    raise task.retry(exc=error, countdown=countdown)


def _whole_stock_quantity(value: object) -> int:
    """Accept Odoo's numeric wire values only when they fit local unit stock."""
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError(f"Invalid Odoo inventory quantity: {value!r}") from error

    if quantity < 0 or quantity != quantity.to_integral_value():
        raise ValueError(f"Odoo inventory quantity must be a non-negative whole unit: {value!r}")
    return int(quantity)


def _apply_inventory_page(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int, int]:
    """Apply one Odoo inventory page by SKU and return durable change events."""
    normalized_rows: list[tuple[str, int]] = []
    skipped = 0
    for row in rows:
        sku = str(row.get("default_code") or "").strip()
        if not sku:
            logger.warning("Ignoring Odoo product without default_code: %s", row.get("id"))
            skipped += 1
            continue
        try:
            normalized_rows.append((sku, _whole_stock_quantity(row.get("qty_available"))))
        except ValueError as error:
            logger.warning("Ignoring Odoo inventory record for SKU %s: %s", sku, error)
            skipped += 1

    if not normalized_rows:
        return [], 0, skipped

    skus = {sku for sku, _ in normalized_rows}
    with _sync_database_session() as db:
        products_by_sku = {
            product.sku: product
            for product in db.scalars(select(ProductTemplate).where(ProductTemplate.sku.in_(skus)))
        }
        changes: list[dict[str, Any]] = []
        unchanged = 0
        for sku, new_quantity in normalized_rows:
            product = products_by_sku.get(sku)
            if product is None:
                logger.info("Odoo inventory SKU %s has no local catalog product", sku)
                skipped += 1
                continue
            if product.stock_qty == new_quantity:
                unchanged += 1
                continue
            previous_quantity = product.stock_qty
            product.stock_qty = new_quantity
            changes.append(
                {
                    "product_id": product.id,
                    "sku": product.sku,
                    "previous_quantity": previous_quantity,
                    "new_quantity": new_quantity,
                    "source": "odoo_periodic_sync",
                }
            )
        db.flush()
        for change in changes:
            enqueue_domain_event_sync(
                db,
                InventoryUpdated(payload=change),
                source_context="odoo_periodic",
            )

    # The outbox records were committed with the local stock changes.  Wake the
    # dispatcher only after that commit; its scheduled sweep remains the safe
    # fallback if Redis is unavailable at this instant.
    if changes:
        request_outbox_dispatch()
    return changes, unchanged, skipped


@celery_app.task(
    bind=True,
    name="app.integrations.odoo.tasks.sync_inventory",
    max_retries=5,
    default_retry_delay=5,
)
def sync_inventory(self: Any) -> dict[str, Any]:
    """Periodically mirror Odoo's SKU stock into local product inventory."""
    if not _odoo_ready():
        return _skipped("sync_inventory")

    try:
        offset = 0
        pages = 0
        received = 0
        updated = 0
        unchanged = 0
        skipped = 0
        while True:
            rows = odoo_client.get_products(limit=PAGE_SIZE, offset=offset)
            if not rows:
                break
            pages += 1
            received += len(rows)
            changes, page_unchanged, page_skipped = _apply_inventory_page(rows)
            updated += len(changes)
            unchanged += page_unchanged
            skipped += page_skipped
            if len(rows) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        logger.info(
            (
                "Odoo inventory sync completed: pages=%s received=%s updated=%s "
                "unchanged=%s skipped=%s"
            ),
            pages,
            received,
            updated,
            unchanged,
            skipped,
        )
        return {
            "status": "synced",
            "pages": pages,
            "received": received,
            "updated": updated,
            "unchanged": unchanged,
            "skipped": skipped,
        }
    except Exception as error:
        return _retry(self, "sync_inventory", error)


def _parse_odoo_rate_date(value: object) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.min)
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError(f"Invalid Odoo rate date: {value!r}")
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _extract_odoo_currency_id(value: object) -> int | None:
    if isinstance(value, list | tuple) and value:
        value = value[0]
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _apply_currency_rates(
    remote_currencies: list[dict[str, Any]], remote_rates: list[dict[str, Any]]
) -> tuple[int, int, int]:
    """Upsert local currency master/rate records from Odoo's rate ledger."""
    odoo_currency_by_id: dict[int, dict[str, Any]] = {}
    for remote_currency in remote_currencies:
        currency_id = _extract_odoo_currency_id(remote_currency.get("id"))
        currency_code = str(remote_currency.get("name") or "").strip().upper()
        if currency_id is not None and currency_code:
            odoo_currency_by_id[currency_id] = {
                "code": currency_code,
                "symbol": str(remote_currency.get("symbol") or currency_code)[:8],
            }

    created = 0
    updated = 0
    skipped = 0
    with _sync_database_session() as db:
        local_currencies = {currency.name: currency for currency in db.scalars(select(Currency))}
        rates_by_currency_and_day: dict[tuple[int, date], CurrencyRate] = {}
        for local_rate in db.scalars(select(CurrencyRate)):
            rates_by_currency_and_day[(local_rate.currency_id, local_rate.date.date())] = local_rate

        for remote_rate in remote_rates:
            odoo_currency_id = _extract_odoo_currency_id(remote_rate.get("currency_id"))
            remote_currency = odoo_currency_by_id.get(odoo_currency_id or -1)
            if remote_currency is None:
                logger.warning("Ignoring Odoo rate with unknown currency: %s", remote_rate)
                skipped += 1
                continue
            try:
                rate = Decimal(str(remote_rate.get("rate")))
                rate_date = _parse_odoo_rate_date(remote_rate.get("name"))
            except (InvalidOperation, TypeError, ValueError) as error:
                logger.warning("Ignoring invalid Odoo currency rate %s: %s", remote_rate, error)
                skipped += 1
                continue
            if rate <= 0:
                logger.warning("Ignoring non-positive Odoo currency rate: %s", remote_rate)
                skipped += 1
                continue

            currency = local_currencies.get(remote_currency["code"])
            if currency is None:
                currency = Currency(
                    name=remote_currency["code"],
                    symbol=remote_currency["symbol"],
                    is_active=True,
                )
                db.add(currency)
                db.flush()
                local_currencies[currency.name] = currency

            key = (currency.id, rate_date.date())
            existing_rate = rates_by_currency_and_day.get(key)
            if existing_rate is None:
                db.add(CurrencyRate(currency_id=currency.id, rate=rate, date=rate_date))
                created += 1
            elif existing_rate.rate != rate:
                existing_rate.rate = rate
                existing_rate.date = rate_date
                updated += 1
        db.flush()

    return created, updated, skipped


@celery_app.task(
    bind=True,
    name="app.integrations.odoo.tasks.sync_currency_rates",
    max_retries=5,
    default_retry_delay=5,
)
def sync_currency_rates(self: Any) -> dict[str, Any]:
    """Mirror Odoo's authoritative active-currency rate ledger locally."""
    if not _odoo_ready():
        return _skipped("sync_currency_rates")

    try:
        remote_currencies = odoo_client.get_currencies()
        currency_ids = [
            currency_id
            for currency in remote_currencies
            if (currency_id := _extract_odoo_currency_id(currency.get("id"))) is not None
        ]
        remote_rates = odoo_client.get_currency_rates(currency_ids)
        created, updated, skipped = _apply_currency_rates(remote_currencies, remote_rates)
        logger.info(
            (
                "Odoo currency-rate sync completed: currencies=%s rates=%s "
                "created=%s updated=%s skipped=%s"
            ),
            len(remote_currencies),
            len(remote_rates),
            created,
            updated,
            skipped,
        )
        return {
            "status": "synced",
            "currencies": len(remote_currencies),
            "rates": len(remote_rates),
            "created": created,
            "updated": updated,
            "skipped": skipped,
        }
    except Exception as error:
        return _retry(self, "sync_currency_rates", error)


def _load_order_snapshot(order_id: int) -> dict[str, Any] | None:
    """Copy the minimum local order data needed outside the database session."""
    with _sync_database_session() as db:
        order = db.get(SaleOrder, order_id)
        if order is None:
            return None
        if order.odoo_order_id is not None:
            return {
                "id": order.id,
                "name": order.name,
                "odoo_order_id": order.odoo_order_id,
            }

        partner = order.partner
        if partner is None:
            raise ValueError(f"Sale order {order.name} has no customer partner")

        product_ids = [line.product_id for line in order.order_lines]
        products_by_id = {
            product.id: product
            for product in db.scalars(
                select(ProductTemplate).where(ProductTemplate.id.in_(product_ids))
            )
        }
        lines: list[dict[str, Any]] = []
        for line in order.order_lines:
            product = products_by_id.get(line.product_id)
            if product is None:
                raise ValueError(
                    f"Sale order {order.name} references missing product id {line.product_id}"
                )
            lines.append(
                {
                    "sku": product.sku,
                    "name": product.name,
                    "quantity": line.quantity,
                    "unit_price": float(line.unit_price),
                    "discount_percent": float(line.discount_percent),
                }
            )

        return {
            "id": order.id,
            "name": order.name,
            "state": order.state,
            "payment_status": order.payment_status,
            "notes": order.notes,
            "partner": {"email": partner.email, "name": partner.name, "phone": partner.phone},
            "lines": lines,
        }


def _persist_odoo_order_id(order_id: int, odoo_order_id: int) -> int:
    """Store the remote id, preserving a newer trusted Odoo webhook value."""
    with _sync_database_session() as db:
        order = db.get(SaleOrder, order_id)
        if order is None:
            raise LookupError(f"Local sale order {order_id} no longer exists")
        if order.odoo_order_id is not None and order.odoo_order_id != odoo_order_id:
            logger.warning(
                "Not overwriting Odoo id for order %s: existing=%s remote=%s",
                order.name,
                order.odoo_order_id,
                odoo_order_id,
            )
            return order.odoo_order_id
        order.odoo_order_id = odoo_order_id
        db.flush()
        return odoo_order_id


@celery_app.task(
    bind=True,
    name="app.integrations.odoo.tasks.sync_order_to_odoo",
    max_retries=5,
    default_retry_delay=5,
)
def sync_order_to_odoo(self: Any, order_id: int) -> dict[str, Any]:
    """Create (or recover) an Odoo sale order for one local checkout order."""
    if not _odoo_ready():
        return _skipped("sync_order_to_odoo")

    try:
        order = _load_order_snapshot(order_id)
        if order is None:
            logger.warning("Skipping Odoo order sync; local order %s does not exist", order_id)
            return {"status": "skipped", "reason": "order_not_found", "order_id": order_id}
        if order.get("odoo_order_id") is not None:
            return {
                "status": "already_synced",
                "order_id": order_id,
                "odoo_order_id": order["odoo_order_id"],
            }

        remote_order = odoo_client.find_sale_order_by_reference(order["name"])
        created = remote_order is None
        if remote_order is None:
            odoo_partner_id = odoo_client.find_or_create_partner(**order["partner"])
            odoo_lines: list[tuple[int, int, dict[str, Any]]] = []
            for line in order["lines"]:
                odoo_product_id = odoo_client.find_product_by_sku(line["sku"])
                if odoo_product_id is None:
                    raise ValueError(
                        "Odoo product is missing for local SKU "
                        f"{line['sku']}; cannot create sale order"
                    )
                odoo_lines.append(
                    (
                        0,
                        0,
                        {
                            "product_id": odoo_product_id,
                            "name": line["name"],
                            "product_uom_qty": line["quantity"],
                            "price_unit": line["unit_price"],
                            "discount": line["discount_percent"],
                        },
                    )
                )

            remote_order_id = odoo_client.create_sale_order(
                {
                    "partner_id": odoo_partner_id,
                    "client_order_ref": order["name"],
                    "origin": f"Elitedom Store {order['name']}",
                    "note": order["notes"] or "",
                    "order_line": odoo_lines,
                }
            )
            remote_state = "draft"
        else:
            remote_order_id = int(remote_order["id"])
            remote_state = str(remote_order.get("state") or "draft")

        should_confirm = order["payment_status"] == "paid" or order["state"] in {"sale", "done"}
        confirmed = False
        if should_confirm and (created or remote_state in {"draft", "sent"}):
            confirmation_result = odoo_client.confirm_sale_order(remote_order_id)
            if not confirmation_result:
                raise RuntimeError(f"Odoo did not confirm sale order {remote_order_id}")
            confirmed = True

        persisted_odoo_order_id = _persist_odoo_order_id(order_id, remote_order_id)
        logger.info(
            "Odoo order sync completed: local=%s remote=%s created=%s confirmed=%s",
            order_id,
            persisted_odoo_order_id,
            created,
            confirmed,
        )
        return {
            "status": "synced",
            "order_id": order_id,
            "odoo_order_id": persisted_odoo_order_id,
            "created": created,
            "confirmed": confirmed,
        }
    except Exception as error:
        return _retry(self, "sync_order_to_odoo", error)

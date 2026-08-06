"""Celery entry points for the safe Algolia product-index writer.

They are deliberately not wired to the transactional outbox here.  The tasks
can be connected later without changing their product-only payload contract.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, selectinload

from app.celery_app import celery_app
from app.config import Settings
from app.integrations.algolia.service import AlgoliaIndexingService
from app.models import ProductTemplate

logger = logging.getLogger(__name__)
MAX_RETRIES = 5


@contextmanager
def _sync_database_session(settings: Settings) -> Iterator[Session]:
    """Open a short-lived synchronous session for an isolated Celery job."""
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


def _new_service() -> AlgoliaIndexingService:
    return AlgoliaIndexingService()


def _positive_product_id(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("product_id must be a positive integer.")
    return value


def _product_query(product_id: int):
    return (
        select(ProductTemplate)
        .options(
            selectinload(ProductTemplate.category),
            selectinload(ProductTemplate.images),
        )
        .where(ProductTemplate.id == product_id)
    )


def _active_products_query():
    return (
        select(ProductTemplate)
        .options(
            selectinload(ProductTemplate.category),
            selectinload(ProductTemplate.images),
        )
        .where(ProductTemplate.is_active.is_(True))
        .order_by(ProductTemplate.id)
    )


def _retry(task: Any, operation: str, error: Exception, *, product_id: int | None = None) -> None:
    """Retry transient provider or database failures with a bounded backoff."""
    retry_number = task.request.retries
    countdown = 5 * (3**retry_number)
    context = f" product_id={product_id}" if product_id is not None else ""
    logger.exception(
        "Algolia %s failed%s; retrying in %ss (attempt %s)",
        operation,
        context,
        countdown,
        retry_number + 1,
    )
    raise task.retry(exc=error, countdown=countdown)


@celery_app.task(
    bind=True,
    name="app.integrations.algolia.tasks.index_product",
    max_retries=MAX_RETRIES,
    default_retry_delay=5,
)
def index_product(self: Any, product_id: int) -> dict[str, Any]:
    """Load current local product data and upsert it into Algolia by id."""
    normalized_id = _positive_product_id(product_id)
    service = _new_service()
    if not service.is_configured:
        return service.skipped_result("index_product", product_id=normalized_id)

    try:
        with _sync_database_session(service.settings) as db:
            product = db.scalar(_product_query(normalized_id))
            if product is None:
                # A hard-deleted product must not remain searchable.
                return service.delete_product(normalized_id, reason="product_not_found")
            return service.index_product(product)
    except Exception as error:
        _retry(self, "product indexing", error, product_id=normalized_id)


@celery_app.task(
    bind=True,
    name="app.integrations.algolia.tasks.delete_product",
    max_retries=MAX_RETRIES,
    default_retry_delay=5,
)
def delete_product(self: Any, product_id: int) -> dict[str, Any]:
    """Delete an Algolia object by product id without fetching unrelated data."""
    normalized_id = _positive_product_id(product_id)
    service = _new_service()
    if not service.is_configured:
        return service.skipped_result("delete_product", product_id=normalized_id)

    try:
        return service.delete_product(normalized_id)
    except Exception as error:
        _retry(self, "product deletion", error, product_id=normalized_id)


@celery_app.task(
    bind=True,
    name="app.integrations.algolia.tasks.reindex_catalog",
    max_retries=MAX_RETRIES,
    default_retry_delay=5,
)
def reindex_catalog(self: Any) -> dict[str, Any]:
    """Atomically replace Algolia's product index from active local products."""
    service = _new_service()
    if not service.is_configured:
        return service.skipped_result("reindex_catalog")

    try:
        with _sync_database_session(service.settings) as db:
            products = db.scalars(_active_products_query()).all()
            return service.reindex_catalog(products)
    except Exception as error:
        _retry(self, "full catalog reindex", error)

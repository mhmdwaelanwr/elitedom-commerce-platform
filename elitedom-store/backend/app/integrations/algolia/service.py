"""Safe, product-only writer for the Algolia catalog index.

The write API key stays on backend workers.  This module intentionally does
not expose a shopper search endpoint and it never puts customer, supplier,
cost, margin, serial, or order data into Algolia records.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable, Mapping
from typing import Any

from app.config import Settings, get_settings
from app.models import ProductImage, ProductTemplate

logger = logging.getLogger(__name__)

AlgoliaClientFactory = Callable[[str, str], Any]


def _create_search_client(app_id: str, api_key: str) -> Any:
    """Create the SDK client lazily so unconfigured deployments stay offline."""
    from algoliasearch.search_client import SearchClient

    return SearchClient.create(app_id, api_key)


class AlgoliaIndexingService:
    """Index only public product catalog facts using Algolia's write API."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client_factory: AlgoliaClientFactory | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client_factory = client_factory or _create_search_client

    @property
    def settings(self) -> Settings:
        """Expose immutable runtime configuration to the Celery task boundary."""
        return self._settings

    @property
    def is_configured(self) -> bool:
        """Whether the server has every credential required for a write call."""
        return all(
            self._configured_value(value)
            for value in (
                self._settings.algolia_app_id,
                self._settings.algolia_api_key,
                self._settings.algolia_index_name,
            )
        )

    def skipped_result(self, operation: str, *, product_id: int | None = None) -> dict[str, Any]:
        """Return an explicit no-op result without instantiating an SDK client."""
        result: dict[str, Any] = {
            "status": "skipped",
            "operation": operation,
            "reason": "algolia_not_configured",
        }
        if product_id is not None:
            result["product_id"] = product_id
        return result

    def index_product(self, product: ProductTemplate) -> dict[str, Any]:
        """Upsert one active product, or remove a soft-deactivated one."""
        product_id = self._require_product_id(product.id)
        if not self.is_configured:
            return self.skipped_result("index_product", product_id=product_id)
        if not product.is_active:
            return self.delete_product(product_id, reason="product_inactive")

        record = self.product_record(product)
        response = self._index().save_object(record)
        self._wait_for_completion(response)
        logger.info("Algolia accepted product index request for product_id=%s", product_id)
        return {
            "status": "indexed",
            "operation": "index_product",
            "product_id": product_id,
            "object_id": record["objectID"],
            "task_id": self._task_id(response),
        }

    def delete_product(self, product_id: int, *, reason: str | None = None) -> dict[str, Any]:
        """Remove one product document without reading or sending unrelated data."""
        normalized_id = self._require_product_id(product_id)
        if not self.is_configured:
            return self.skipped_result("delete_product", product_id=normalized_id)

        object_id = str(normalized_id)
        response = self._index().delete_object(object_id)
        self._wait_for_completion(response)
        logger.info("Algolia accepted product delete request for product_id=%s", normalized_id)
        result: dict[str, Any] = {
            "status": "deleted",
            "operation": "delete_product",
            "product_id": normalized_id,
            "object_id": object_id,
            "task_id": self._task_id(response),
        }
        if reason is not None:
            result["reason"] = reason
        return result

    def reindex_catalog(self, products: Iterable[ProductTemplate]) -> dict[str, Any]:
        """Atomically replace the public index from the current active catalog."""
        if not self.is_configured:
            return self.skipped_result("reindex_catalog")

        records = [self.product_record(product) for product in products if product.is_active]
        # The SDK's safe mode waits for each copy/save/move operation.  This is
        # appropriate for a Celery job and prevents a partial catalog swap.
        response = self._index().replace_all_objects(records, {"safe": True})
        logger.info("Algolia accepted full catalog reindex for products=%s", len(records))
        return {
            "status": "reindexed",
            "operation": "reindex_catalog",
            "indexed_count": len(records),
            "task_id": self._task_id(response),
        }

    def product_record(self, product: ProductTemplate) -> dict[str, Any]:
        """Build an Algolia record from shopper-visible product data only."""
        product_id = self._require_product_id(product.id)
        category_name = self._clean_text(product.category.name) if product.category else None
        image_url = self._primary_image_url(product.images)
        record: dict[str, Any] = {
            "objectID": str(product_id),
            "id": product_id,
            "name": product.name,
            "sku": product.sku,
            "description": self._clean_text(product.description),
            "brand": self._clean_text(product.brand),
            "category_id": product.category_id,
            "category_name": category_name,
            "price": float(product.list_price),
            "stock_qty": int(product.stock_qty),
            "in_stock": product.stock_qty > 0,
            "is_dropship_enabled": bool(product.is_dropship_enabled),
            "is_active": bool(product.is_active),
            "image_url": image_url,
            "warranty_months": int(product.warranty_months),
            "socket_type": self._clean_text(product.socket_type),
            "ram_type": self._clean_text(product.ram_type),
            "form_factor": self._clean_text(product.form_factor),
            "power_wattage_draw": int(product.power_wattage_draw),
            "pcie_gen": self._clean_text(product.pcie_gen),
        }
        # Omit unset optional attributes instead of publishing null facets.
        return {key: value for key, value in record.items() if value is not None}

    def _index(self) -> Any:
        """Create an index handle only after the configuration guard passes."""
        client = self._client_factory(
            self._settings.algolia_app_id.strip(),
            self._settings.algolia_api_key.strip(),
        )
        return client.init_index(self._settings.algolia_index_name.strip())

    @staticmethod
    def _configured_value(value: str) -> bool:
        normalized = value.strip() if value else ""
        return bool(normalized) and not normalized.casefold().startswith("change_me")

    @staticmethod
    def _require_product_id(value: int | None) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError("product_id must be a positive integer.")
        return value

    @staticmethod
    def _clean_text(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @classmethod
    def _primary_image_url(cls, images: Iterable[ProductImage]) -> str | None:
        image_list = list(images)
        if not image_list:
            return None
        primary = next((image for image in image_list if image.is_primary), None)
        selected = primary or min(
            image_list,
            key=lambda image: (image.sort_order, image.id or 0),
        )
        return cls._clean_text(selected.url)

    @staticmethod
    def _task_id(response: Any) -> int | None:
        """Extract an SDK task id when present without coupling to response types."""
        candidates: list[Any] = []
        if isinstance(response, Mapping):
            candidates.append(response.get("taskID"))
        raw_responses = getattr(response, "raw_responses", None)
        if isinstance(raw_responses, list):
            candidates.extend(
                item.get("taskID") for item in raw_responses if isinstance(item, Mapping)
            )
        for candidate in candidates:
            if isinstance(candidate, int) and not isinstance(candidate, bool):
                return candidate
        return None

    @staticmethod
    def _wait_for_completion(response: Any) -> None:
        """Wait only when the SDK supplied an asynchronous task response."""
        wait = getattr(response, "wait", None)
        if callable(wait):
            wait()

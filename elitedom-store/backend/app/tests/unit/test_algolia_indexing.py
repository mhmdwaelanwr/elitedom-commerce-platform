"""Mocked coverage for the product-only Algolia indexing boundary."""

from contextlib import contextmanager
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.integrations.algolia import tasks
from app.integrations.algolia.service import AlgoliaIndexingService
from app.models import ProductCategory, ProductImage, ProductTemplate


def _settings(
    *,
    app_id: str = "algolia-app-id",
    api_key: str = "algolia-write-key",
    index_name: str = "elitedom_products_test",
) -> SimpleNamespace:
    return SimpleNamespace(
        algolia_app_id=app_id,
        algolia_api_key=api_key,
        algolia_index_name=index_name,
        database_url_sync="postgresql://unused-in-mocked-tests",
    )


def _product(*, product_id: int = 42, active: bool = True) -> ProductTemplate:
    product = ProductTemplate(
        id=product_id,
        name="  Elitedom RTX Workstation GPU  ",
        sku="GPU-ELI-042",
        description="A public catalog description for professional graphics work.",
        tracking="serial",
        base_cost_usd=Decimal("710.00"),
        target_margin_percent=Decimal("23.00"),
        list_price=Decimal("42500.50"),
        category_id=7,
        brand="  Elitedom  ",
        is_dropship_enabled=False,
        is_active=active,
        stock_qty=3,
        warranty_months=36,
        socket_type="PCIe",
        ram_type="GDDR6X",
        form_factor="Triple Slot",
        power_wattage_draw=450,
        pcie_gen="5.0",
    )
    product.category = ProductCategory(id=7, name="Graphics Cards", slug="graphics-cards")
    product.images = [
        ProductImage(
            id=3,
            product_id=product_id,
            url="https://cdn.example.test/products/gpu-secondary.jpg",
            sort_order=20,
            is_primary=False,
        ),
        ProductImage(
            id=2,
            product_id=product_id,
            url="https://cdn.example.test/products/gpu-primary.jpg",
            sort_order=10,
            is_primary=True,
        ),
    ]
    return product


def _configured_service() -> tuple[AlgoliaIndexingService, Mock, Mock, Mock]:
    index = Mock()
    client = Mock()
    client.init_index.return_value = index
    factory = Mock(return_value=client)
    service = AlgoliaIndexingService(
        settings=_settings(),  # type: ignore[arg-type]
        client_factory=factory,
    )
    return service, factory, client, index


def test_index_product_publishes_only_current_public_catalog_fields() -> None:
    service, factory, client, index = _configured_service()
    response = Mock(raw_responses=[{"taskID": 81}])
    index.save_object.return_value = response

    result = service.index_product(_product())

    assert result == {
        "status": "indexed",
        "operation": "index_product",
        "product_id": 42,
        "object_id": "42",
        "task_id": 81,
    }
    factory.assert_called_once_with("algolia-app-id", "algolia-write-key")
    client.init_index.assert_called_once_with("elitedom_products_test")
    response.wait.assert_called_once_with()
    record = index.save_object.call_args.args[0]
    assert record["objectID"] == "42"
    assert record["id"] == 42
    assert record["name"] == "  Elitedom RTX Workstation GPU  "
    assert record["brand"] == "Elitedom"
    assert record["category_name"] == "Graphics Cards"
    assert record["price"] == 42500.5
    assert record["stock_qty"] == 3
    assert record["in_stock"] is True
    assert record["image_url"].endswith("gpu-primary.jpg")
    assert record["socket_type"] == "PCIe"
    assert record["ram_type"] == "GDDR6X"
    assert record["power_wattage_draw"] == 450
    assert not {
        "base_cost_usd",
        "target_margin_percent",
        "tracking",
        "serial_lots",
        "supplier_links",
        "tags",
    }.intersection(record)


def test_inactive_product_is_deleted_instead_of_indexed() -> None:
    service, _, _, index = _configured_service()
    index.delete_object.return_value = {"taskID": 82}

    result = service.index_product(_product(active=False))

    assert result["status"] == "deleted"
    assert result["reason"] == "product_inactive"
    index.delete_object.assert_called_once_with("42")
    index.save_object.assert_not_called()


def test_missing_or_placeholder_credentials_never_create_an_sdk_client() -> None:
    factory = Mock(side_effect=AssertionError("network client must not be created"))
    service = AlgoliaIndexingService(
        settings=_settings(app_id="CHANGE_ME_ALGOLIA_APP_ID"),  # type: ignore[arg-type]
        client_factory=factory,
    )
    product = _product()

    assert service.index_product(product) == {
        "status": "skipped",
        "operation": "index_product",
        "reason": "algolia_not_configured",
        "product_id": product.id,
    }
    assert service.delete_product(product.id) == {
        "status": "skipped",
        "operation": "delete_product",
        "reason": "algolia_not_configured",
        "product_id": product.id,
    }
    assert service.reindex_catalog([product]) == {
        "status": "skipped",
        "operation": "reindex_catalog",
        "reason": "algolia_not_configured",
    }
    factory.assert_not_called()


def test_reindex_atomically_replaces_the_active_catalog() -> None:
    service, _, _, index = _configured_service()
    index.replace_all_objects.return_value = {"taskID": 83}

    result = service.reindex_catalog([_product(), _product(product_id=43, active=False)])

    assert result == {
        "status": "reindexed",
        "operation": "reindex_catalog",
        "indexed_count": 1,
        "task_id": 83,
    }
    records, request_options = index.replace_all_objects.call_args.args
    assert [record["objectID"] for record in records] == ["42"]
    assert request_options == {"safe": True}


def test_tasks_skip_before_opening_a_database_or_creating_a_network_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory = Mock(side_effect=AssertionError("network client must not be created"))
    service = AlgoliaIndexingService(
        settings=_settings(api_key=""),  # type: ignore[arg-type]
        client_factory=factory,
    )
    database_session = Mock(side_effect=AssertionError("database must not open"))
    monkeypatch.setattr(tasks, "_new_service", lambda: service)
    monkeypatch.setattr(tasks, "_sync_database_session", database_session)

    assert tasks.index_product.run(42)["status"] == "skipped"
    assert tasks.delete_product.run(42)["status"] == "skipped"
    assert tasks.reindex_catalog.run()["status"] == "skipped"
    database_session.assert_not_called()
    factory.assert_not_called()


def test_index_task_loads_the_current_product_by_id_before_calling_the_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    product = _product()
    service = Mock()
    service.is_configured = True
    service.settings = _settings()
    service.index_product.return_value = {"status": "indexed", "product_id": product.id}
    database = Mock()
    database.scalar.return_value = product

    @contextmanager
    def fake_session(_: SimpleNamespace):
        yield database

    monkeypatch.setattr(tasks, "_new_service", lambda: service)
    monkeypatch.setattr(tasks, "_sync_database_session", fake_session)

    assert tasks.index_product.run(product.id) == {
        "status": "indexed",
        "product_id": product.id,
    }
    database.scalar.assert_called_once()
    service.index_product.assert_called_once_with(product)


def test_provider_failure_is_retried_with_bounded_initial_backoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = Mock()
    service.is_configured = True
    service.delete_product.side_effect = ConnectionError("provider unavailable")
    retry = Mock(side_effect=RuntimeError("retry scheduled"))
    monkeypatch.setattr(tasks, "_new_service", lambda: service)
    monkeypatch.setattr(tasks.delete_product, "retry", retry)

    with pytest.raises(RuntimeError, match="retry scheduled"):
        tasks.delete_product.run(42)

    retry.assert_called_once()
    assert retry.call_args.kwargs["countdown"] == 5
    assert isinstance(retry.call_args.kwargs["exc"], ConnectionError)

"""Regression coverage for request correlation and Prometheus exposure."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_response_propagates_safe_request_id(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "test-trace-12345678"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "test-trace-12345678"


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_http_red_metrics(client: AsyncClient) -> None:
    response = await client.get("/metrics")

    assert response.status_code == 200
    assert "http_request_duration" in response.text

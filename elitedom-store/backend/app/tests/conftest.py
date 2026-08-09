"""
Pytest configuration and shared fixtures for Elitedom Store backend testing.
"""

import os
from collections.abc import AsyncGenerator

# Keep the test suite isolated from arbitrary shell or CI environment values.
# Settings are instantiated while importing the application modules below, so
# these must be set before those imports.
os.environ.update(
    {
        "ENVIRONMENT": "development",
        "DEBUG": "false",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-for-validation",
        "POSTGRES_PASSWORD": "test-postgres-password",
        "JWT_SECRET_KEY": "test-jwt-secret-key-that-is-long-enough-for-validation",
        "ODOO_SYNC_ENABLED": "false",
        "ODOO_WEBHOOKS_ENABLED": "true",
        "ODOO_WEBHOOK_SECRET": "test-odoo-webhook-secret-that-is-long-enough-for-validation",
        "TRUSTED_PROXY_IPS": "10.0.0.1",
    }
)

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.middleware import rate_limit

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
async def setup_database():
    """Create isolated database and middleware state before each test."""
    # Every ASGI test client uses the same testserver peer address. Without
    # clearing this process-local window, unrelated tests eventually share the
    # production request budget and fail with 429 responses based on test order.
    rate_limit._request_counts.clear()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield
    finally:
        rate_limit._request_counts.clear()
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        # aiosqlite owns a worker thread per pooled connection. Disposing it
        # after each isolated in-memory database prevents pytest from waiting
        # indefinitely for that thread after the test summary is printed.
        await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for a test."""
    async with test_session_factory() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Yield an async HTTP test client with database dependency override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()

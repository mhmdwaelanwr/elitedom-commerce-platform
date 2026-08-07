"""
Elitedom Store — Database Engine & Session Management
Async SQLAlchemy engine with PostgreSQL 15.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    pass


async def _cleanup_catalog_media(urls: list[str]) -> None:
    if not urls:
        return
    from app.modules.products.catalog_media import delete_catalog_media_object

    for url in urls:
        await delete_catalog_media_object(url)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()

            # Media objects live outside PostgreSQL. Removed/replaced objects
            # are deleted only after a durable commit; rollback cleanup removes
            # only objects created by the failed transaction. The helper is
            # provider-aware for local volumes and S3-compatible object stores.
            delete_after_commit = session.info.pop(
                "catalog_media_delete_after_commit",
                [],
            )
            session.info.pop("catalog_media_delete_on_rollback", None)
            await _cleanup_catalog_media(delete_after_commit)

            if session.info.pop("outbox_dispatch_requested", False):
                from app.shared.outbox import request_outbox_dispatch

                request_outbox_dispatch()
        except Exception:
            await session.rollback()
            delete_on_rollback = session.info.pop(
                "catalog_media_delete_on_rollback",
                [],
            )
            session.info.pop("catalog_media_delete_after_commit", None)
            await _cleanup_catalog_media(delete_on_rollback)
            raise
        finally:
            await session.close()

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

# Async engine — connection pool for PostgreSQL
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()

            # Stage 8 local media writes cannot participate in the PostgreSQL
            # transaction. Delete replaced/removed files only after the DB
            # commit is durable; if a request rolls back, keep the old file.
            delete_after_commit = session.info.pop(
                "catalog_media_delete_after_commit", []
            )
            session.info.pop("catalog_media_delete_on_rollback", None)
            if delete_after_commit:
                from app.modules.products.catalog_media import delete_catalog_media_file

                for url in delete_after_commit:
                    delete_catalog_media_file(url)

            # Event rows are written in the same transaction as the business
            # change.  Wake Celery only after that commit, so a worker can
            # never observe an event for a rolled-back checkout or stock edit.
            if session.info.pop("outbox_dispatch_requested", False):
                from app.shared.outbox import request_outbox_dispatch

                request_outbox_dispatch()
        except Exception:
            await session.rollback()
            delete_on_rollback = session.info.pop(
                "catalog_media_delete_on_rollback", []
            )
            session.info.pop("catalog_media_delete_after_commit", None)
            if delete_on_rollback:
                from app.modules.products.catalog_media import delete_catalog_media_file

                for url in delete_on_rollback:
                    delete_catalog_media_file(url)
            raise
        finally:
            await session.close()

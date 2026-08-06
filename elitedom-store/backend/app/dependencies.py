"""
Elitedom Store — Shared Dependencies
Common FastAPI dependency injectors used across modules.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db


async def get_database(db: AsyncSession = Depends(get_db)) -> AsyncSession:
    """Alias dependency for database session injection."""
    return db


def get_config() -> Settings:
    """Dependency for injecting application settings."""
    return get_settings()

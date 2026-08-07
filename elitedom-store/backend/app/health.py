"""Liveness and dependency-aware readiness checks."""

from __future__ import annotations

import asyncio

from redis.asyncio import Redis
from sqlalchemy import text

from app.config import get_settings
from app.database import engine

settings = get_settings()


async def _database_ready() -> bool:
    try:
        async with asyncio.timeout(settings.readiness_timeout_seconds):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def _redis_ready() -> bool:
    client = Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=settings.readiness_timeout_seconds,
        socket_timeout=settings.readiness_timeout_seconds,
    )
    try:
        async with asyncio.timeout(settings.readiness_timeout_seconds):
            return bool(await client.ping())
    except Exception:
        return False
    finally:
        await client.aclose()


async def readiness_snapshot() -> dict[str, object]:
    database, redis = await asyncio.gather(_database_ready(), _redis_ready())
    ready = database and redis
    return {
        "status": "ready" if ready else "not_ready",
        "ready": ready,
        "dependencies": {
            "postgres": "ready" if database else "unavailable",
            "redis": "ready" if redis else "unavailable",
        },
    }

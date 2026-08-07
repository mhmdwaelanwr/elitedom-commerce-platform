"""Distributed request rate limiting with stricter authentication budgets."""

from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict
from collections.abc import Callable

from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

EXCLUDED_PATHS = {"/health", "/health/live", "/health/ready", "/docs", "/redoc", "/openapi.json"}
_AUTH_LIMITS: tuple[tuple[str, int, int], ...] = (
    ("/api/v1/auth/login", 10, 60),
    ("/api/v1/auth/otp/request", 5, 600),
    ("/api/v1/auth/otp/verify", 15, 600),
    ("/api/v1/auth/mfa/confirm", 10, 300),
    ("/api/v1/auth/mfa/verify", 10, 300),
    ("/api/v1/auth/refresh", 30, 60),
)
_memory_counts: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))
_redis: Redis | None = None

_REDIS_SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""


def _client_ip(request: Request) -> str:
    peer_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and peer_ip in settings.trusted_proxy_ip_set:
        return forwarded.split(",")[0].strip() or peer_ip
    return peer_ip


def _policy(path: str) -> tuple[int, int, str]:
    for prefix, limit, window in _AUTH_LIMITS:
        if path == prefix:
            return limit, window, prefix
    return settings.rate_limit_default_per_minute, 60, "default"


def _redis_client() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=settings.readiness_timeout_seconds,
            socket_timeout=settings.readiness_timeout_seconds,
        )
    return _redis


async def _redis_increment(key: str, window: int) -> tuple[int, int]:
    result = await _redis_client().eval(_REDIS_SCRIPT, 1, key, window)
    count = int(result[0])
    ttl = max(int(result[1]), 1)
    return count, ttl


def _memory_increment(key: str, window: int) -> tuple[int, int]:
    now = time.time()
    count, reset_at = _memory_counts[key]
    if reset_at <= now:
        count = 0
        reset_at = now + window
    count += 1
    _memory_counts[key] = (count, reset_at)
    return count, max(int(reset_at - now), 1)


def _error(status_code: int, message: str, *, retry_after: int | None = None) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if retry_after is not None:
        headers["Retry-After"] = str(max(retry_after, 1))
    return JSONResponse(
        status_code=status_code,
        content={
            "error_code": "ELITE_9001" if status_code == 429 else "ELITE_9002",
            "message": message,
            **({"retry_after_seconds": max(retry_after, 1)} if retry_after is not None else {}),
        },
        headers=headers,
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit requests by trusted client IP using Redis in production."""

    async def dispatch(self, request: Request, call_next: Callable):
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        limit, window, policy_name = _policy(request.url.path)
        client_ip = _client_ip(request)
        window_bucket = int(time.time()) // window
        identity = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()[:24]
        key = f"elitedom:rate:{policy_name}:{identity}:{window_bucket}"

        try:
            if settings.rate_limit_backend == "redis":
                count, retry_after = await _redis_increment(key, window)
            else:
                count, retry_after = _memory_increment(key, window)
        except RedisError:
            logger.exception("rate_limit_backend_unavailable")
            return _error(
                503,
                "Request protection is temporarily unavailable. Please try again shortly.",
                retry_after=5,
            )

        remaining = max(limit - count, 0)
        if count > limit:
            response = _error(
                429,
                "Rate limit exceeded. Please try again later.",
                retry_after=retry_after,
            )
        else:
            response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + retry_after)
        return response

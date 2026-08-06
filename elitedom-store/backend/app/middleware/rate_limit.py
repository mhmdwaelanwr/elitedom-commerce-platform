"""
Elitedom Store — Rate Limiting Middleware
Protects API endpoints from abuse per API_SECURITY.md.
"""

import time
from collections import defaultdict
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import get_settings

# Simple in-memory sliding window rate limiter
# For production, this should be backed by Redis
_request_counts: dict[str, list[float]] = defaultdict(list)

# Rate limit configuration
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 100  # max requests per window
RATE_LIMIT_BURST = 20  # max burst in 10 seconds

# Paths excluded from rate limiting
EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}
settings = get_settings()


def _client_ip(request: Request) -> str:
    """Use forwarded client addresses only from a configured trusted proxy."""
    peer_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and peer_ip in settings.trusted_proxy_ip_set:
        return forwarded.split(",")[0].strip() or peer_ip
    return peer_ip


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter.
    100 requests per minute per IP address.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        # Skip rate limiting for health checks and docs
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        # Get client IP
        client_ip = _client_ip(request)

        now = time.time()
        key = f"{client_ip}"

        # Clean old entries outside the window
        _request_counts[key] = [ts for ts in _request_counts[key] if now - ts < RATE_LIMIT_WINDOW]

        # Check rate limit
        if len(_request_counts[key]) >= RATE_LIMIT_MAX_REQUESTS:
            retry_after = int(RATE_LIMIT_WINDOW - (now - _request_counts[key][0]))
            return JSONResponse(
                status_code=429,
                content={
                    "error_code": "ELITE_9001",
                    "message": "Rate limit exceeded. Please try again later.",
                    "retry_after_seconds": max(retry_after, 1),
                },
                headers={"Retry-After": str(max(retry_after, 1))},
            )

        # Record this request
        _request_counts[key].append(now)

        # Add rate limit headers to response
        response = await call_next(request)
        remaining = RATE_LIMIT_MAX_REQUESTS - len(_request_counts[key])
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_MAX_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(max(remaining, 0))
        response.headers["X-RateLimit-Reset"] = str(
            int(_request_counts[key][0] + RATE_LIMIT_WINDOW)
        )

        return response

"""Safe-by-default logging, metrics, and tracing for the Store API.

The module deliberately avoids recording request bodies, query parameters, or
customer identifiers.  It supplies a correlation id to every HTTP response
and enables exporters only when an explicitly configured collector exists.
"""

from __future__ import annotations

import logging
import re
import time
from contextvars import ContextVar
from datetime import UTC, datetime
from uuid import uuid4

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger.json import JsonFormatter
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import Settings
from app.database import engine

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")

_REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9._:-]{8,128}\Z")
_EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_BEARER_PATTERN = re.compile(r"(?i)(bearer\s+)[^\s,;]+")
_TOKEN_PATTERN = re.compile(
    r"(?i)((?:api[_-]?key|authorization|password|secret|token)\s*[=:]\s*)[^\s,;]+"
)

logger = logging.getLogger(__name__)
_tracing_configured = False


class PIIRedactionFilter(logging.Filter):
    """Mask common secrets and email values before they leave the process."""

    def filter(self, record: logging.LogRecord) -> bool:
        rendered = record.getMessage()
        redacted = _TOKEN_PATTERN.sub(r"\1<redacted>", rendered)
        redacted = _BEARER_PATTERN.sub(r"\1<redacted>", redacted)
        redacted = _EMAIL_PATTERN.sub("<email-redacted>", redacted)
        record.msg = redacted
        record.args = ()
        return True


class ServiceJsonFormatter(JsonFormatter):
    """Emit the minimum structured fields required by LOGGING.md."""

    def __init__(self, *, service_name: str) -> None:
        super().__init__()
        self.service_name = service_name

    def add_fields(
        self,
        log_record: dict,
        record: logging.LogRecord,
        message_dict: dict,
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = datetime.now(UTC).isoformat()
        log_record["level"] = record.levelname
        log_record["service_name"] = self.service_name
        log_record["request_id"] = request_id_context.get()


class RequestContextMiddleware:
    """Attach a trusted correlation id and emit one PII-safe request log."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_headers = Headers(scope=scope)
        supplied_request_id = request_headers.get("x-request-id", "")
        request_id = (
            supplied_request_id
            if _REQUEST_ID_PATTERN.fullmatch(supplied_request_id)
            else str(uuid4())
        )
        token = request_id_context.set(request_id)
        started_at = time.perf_counter()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                response_headers = MutableHeaders(scope=message)
                response_headers["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            logger.info(
                "http_request_completed",
                extra={
                    "event": "http_request_completed",
                    "http_method": scope.get("method", ""),
                    # Deliberately omit query strings: they can contain PII or
                    # opaque credentials from third-party callback URLs.
                    "http_path": scope.get("path", ""),
                    "http_status_code": status_code,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
            )
            request_id_context.reset(token)


def configure_logging(settings: Settings) -> None:
    """Replace process logging with JSON and install global PII masking."""

    root_logger = logging.getLogger()
    handler = logging.StreamHandler()
    handler.setFormatter(ServiceJsonFormatter(service_name=settings.otel_service_name))
    handler.addFilter(PIIRedactionFilter())
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    # Uvicorn installs dedicated handlers with ``propagate=False``.  Replace
    # them too, otherwise only application logs would meet the JSON contract.
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        managed_logger = logging.getLogger(logger_name)
        managed_logger.handlers.clear()
        managed_logger.addHandler(handler)
        managed_logger.propagate = False


def configure_observability(app: ASGIApp, settings: Settings) -> None:
    """Install metrics and optional OTLP instrumentation exactly once."""

    global _tracing_configured
    configure_logging(settings)

    if settings.metrics_enabled:
        Instrumentator(
            excluded_handlers=["/health", "/metrics"],
            should_instrument_requests_inprogress=True,
        ).instrument(app).expose(
            app,
            endpoint="/metrics",
            include_in_schema=False,
            should_gzip=True,
        )

    if _tracing_configured:
        return

    provider = TracerProvider(
        resource=Resource.create(
            {
                SERVICE_NAME: settings.otel_service_name,
                SERVICE_VERSION: settings.app_version,
                "deployment.environment": settings.environment,
            }
        ),
        sampler=ParentBased(TraceIdRatioBased(settings.otel_trace_sample_ratio)),
    )
    if settings.otel_exporter_otlp_endpoint:
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
        )
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    HTTPXClientInstrumentor().instrument()
    _tracing_configured = True

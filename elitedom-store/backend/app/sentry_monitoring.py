"""PII-safe Sentry setup shared by the FastAPI and Celery processes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import sentry_sdk

from app.config import Settings

_SENSITIVE_KEYS = frozenset(
    {
        "api_key",
        "authorization",
        "card_number",
        "cookie",
        "cookies",
        "cvv",
        "password",
        "paymob_hmac_secret",
        "secret",
        "session",
        "session_id",
        "token",
    }
)
_IGNORED_TRANSACTION_PATHS = ("/health", "/metrics")
_EXCLUDED_CELERY_BEAT_MONITORS = ("dispatch-transactional-outbox-every-15-seconds",)


def _normalized_key(value: object) -> str:
    return str(value).casefold().replace("-", "_")


def _redact_sensitive_values(value: Any) -> Any:
    """Recursively mask known credential and payment fields while preserving structure."""

    if isinstance(value, dict):
        redacted: dict[Any, Any] = {}
        for key, nested_value in value.items():
            normalized = _normalized_key(key)
            if normalized in _SENSITIVE_KEYS or any(
                normalized.endswith(f"_{suffix}")
                for suffix in ("password", "secret", "token", "api_key")
            ):
                redacted[key] = "<redacted>"
            else:
                redacted[key] = _redact_sensitive_values(nested_value)
        return redacted
    if isinstance(value, list):
        return [_redact_sensitive_values(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact_sensitive_values(item) for item in value)
    return value


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Enforce the repository's no-body/no-query telemetry policy before upload."""

    del hint
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "cookies", "query_string"):
            request.pop(key, None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = _redact_sensitive_values(headers)

    extra = event.get("extra")
    if isinstance(extra, dict):
        celery_job = extra.get("celery-job")
        if isinstance(celery_job, dict):
            for key in ("args", "kwargs"):
                if key in celery_job:
                    celery_job[key] = "<redacted>"
        event["extra"] = _redact_sensitive_values(extra)
    return event


def _traces_sampler(sample_rate: float) -> Callable[[dict[str, Any]], float]:
    """Avoid spending transaction quota on probes while sampling business traffic."""

    def sampler(sampling_context: dict[str, Any]) -> float:
        transaction_context = sampling_context.get("transaction_context")
        transaction_name = ""
        if isinstance(transaction_context, dict):
            transaction_name = str(transaction_context.get("name", "")).casefold()
        asgi_scope = sampling_context.get("asgi_scope")
        request_path = ""
        if isinstance(asgi_scope, dict):
            request_path = str(asgi_scope.get("path", "")).casefold()
        if any(
            path in transaction_name or request_path.startswith(path)
            for path in _IGNORED_TRANSACTION_PATHS
        ):
            return 0.0
        return sample_rate

    return sampler


def configure_sentry(
    settings: Settings,
    *,
    service_name: str,
    monitor_celery_beat: bool = False,
) -> bool:
    """Initialize Sentry when explicitly enabled and return whether it is active."""

    if not settings.sentry_enabled:
        return False

    init_options: dict[str, Any] = {
        "dsn": settings.sentry_dsn,
        "environment": settings.environment,
        "release": settings.sentry_release or None,
        "sample_rate": settings.sentry_error_sample_rate,
        "send_default_pii": False,
        "include_local_variables": False,
        "max_request_body_size": "never",
        "before_send": _before_send,
        "enable_tracing": settings.sentry_traces_sample_rate > 0,
    }
    if settings.sentry_traces_sample_rate > 0:
        init_options["traces_sampler"] = _traces_sampler(
            settings.sentry_traces_sample_rate
        )
    if monitor_celery_beat:
        from sentry_sdk.integrations.celery import CeleryIntegration

        init_options["integrations"] = [
            CeleryIntegration(
                monitor_beat_tasks=True,
                # The outbox dispatcher runs every 15 seconds and is better
                # represented by task errors/metrics than a high-volume Cron.
                exclude_beat_tasks=list(_EXCLUDED_CELERY_BEAT_MONITORS),
            )
        ]

    sentry_sdk.init(**init_options)
    sentry_sdk.set_tag("service", service_name)
    return True

"""Sentry must be opt-in, quota-aware, and safe for commerce data."""

from types import SimpleNamespace

import sentry_sdk

from app.sentry_monitoring import _before_send, _traces_sampler, configure_sentry


def test_before_send_removes_request_and_celery_payloads() -> None:
    event = {
        "request": {
            "data": {"card_number": "4111111111111111"},
            "query_string": "token=customer-token",
            "cookies": {"session": "customer-session"},
            "headers": {
                "authorization": "Bearer customer-token",
                "x-request-id": "safe-request-id",
            },
        },
        "extra": {
            "celery-job": {
                "args": ["customer@example.com"],
                "kwargs": {"payment_token": "provider-token"},
            }
        },
    }

    result = _before_send(event, {})

    assert result is not None
    assert "data" not in result["request"]
    assert "query_string" not in result["request"]
    assert "cookies" not in result["request"]
    assert result["request"]["headers"]["authorization"] == "<redacted>"
    assert result["request"]["headers"]["x-request-id"] == "safe-request-id"
    assert result["extra"]["celery-job"]["args"] == "<redacted>"
    assert result["extra"]["celery-job"]["kwargs"] == "<redacted>"


def test_traces_sampler_excludes_probes_and_samples_business_routes() -> None:
    sampler = _traces_sampler(0.25)

    assert sampler({"transaction_context": {"name": "GET /health/ready"}}) == 0.0
    assert sampler({"transaction_context": {"name": "GET /metrics"}}) == 0.0
    assert sampler({"asgi_scope": {"path": "/health/live"}}) == 0.0
    assert sampler({"transaction_context": {"name": "POST /api/v1/orders"}}) == 0.25


def test_configure_sentry_is_disabled_by_default(monkeypatch) -> None:
    def unexpected_init(**kwargs) -> None:
        raise AssertionError(f"Sentry should not initialize: {kwargs}")

    monkeypatch.setattr(sentry_sdk, "init", unexpected_init)
    settings = SimpleNamespace(sentry_enabled=False)

    assert configure_sentry(settings, service_name="elitedom-fastapi") is False


def test_configure_sentry_uses_privacy_and_release_settings(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tags: dict[str, str] = {}

    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: captured.update(kwargs))
    monkeypatch.setattr(sentry_sdk, "set_tag", lambda key, value: tags.update({key: value}))
    settings = SimpleNamespace(
        sentry_enabled=True,
        sentry_dsn="https://public-key@sentry.example.com/1",
        environment="production",
        sentry_release="0123456789abcdef",
        sentry_error_sample_rate=1.0,
        sentry_traces_sample_rate=0.1,
    )

    assert (
        configure_sentry(
            settings,
            service_name="elitedom-celery",
            monitor_celery_beat=True,
        )
        is True
    )
    assert captured["send_default_pii"] is False
    assert captured["include_local_variables"] is False
    assert captured["max_request_body_size"] == "never"
    assert captured["release"] == "0123456789abcdef"
    assert callable(captured["traces_sampler"])
    celery_integration = captured["integrations"][0]
    assert celery_integration.monitor_beat_tasks is True
    assert celery_integration.exclude_beat_tasks == [
        "dispatch-transactional-outbox-every-15-seconds"
    ]
    assert tags == {"service": "elitedom-celery"}

"""
Elitedom Store — Celery Application
Background task processing with Redis broker.
"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "elitedom",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.integrations.algolia.tasks",
        "app.integrations.odoo.tasks",
        "app.integrations.stripe.tasks",
        "app.integrations.twilio.tasks",
        "app.integrations.sendgrid.tasks",
        "app.integrations.zeptomail.tasks",
        "app.integrations.hedera.tasks",
        "app.modules.orders.tasks",
        "app.shared.outbox_tasks",
    ],
)

# Celery configuration
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="Africa/Cairo",
    enable_utc=True,
    # Task execution
    task_track_started=True,
    task_time_limit=300,  # 5 minutes hard limit
    task_soft_time_limit=240,  # 4 minutes soft limit
    # Retry defaults — exponential backoff per ODOO.md
    task_default_retry_delay=5,  # 5 seconds initial
    task_max_retries=5,
    # Result expiration
    result_expires=3600,  # 1 hour
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    # Beat schedule — cron jobs per AUTOMATION_WORKFLOWS.md
    beat_schedule={
        "sync-odoo-inventory-every-5-min": {
            "task": "app.integrations.odoo.tasks.sync_inventory",
            "schedule": 300.0,  # every 5 minutes
        },
        "update-currency-rates-daily": {
            "task": "app.integrations.odoo.tasks.sync_currency_rates",
            "schedule": 86400.0,  # every 24 hours
        },
        "cleanup-expired-carts-hourly": {
            "task": "app.modules.orders.tasks.cleanup_expired_carts",
            "schedule": 3600.0,  # every hour
        },
        "dispatch-transactional-outbox-every-15-seconds": {
            "task": "app.shared.outbox_tasks.dispatch_pending_outbox",
            "schedule": 15.0,
        },
    },
)

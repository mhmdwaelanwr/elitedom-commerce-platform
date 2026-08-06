"""Elitedom Store — Orders Module Celery Tasks"""

from app.celery_app import celery_app


@celery_app.task(name="app.modules.orders.tasks.cleanup_expired_carts")
def cleanup_expired_carts():
    """Hourly task: Remove abandoned carts older than 7 days."""
    pass

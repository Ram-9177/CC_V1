"""Celery signal handlers for operational visibility (additive; no task behavior change)."""

from __future__ import annotations

import logging

from celery.signals import task_failure

logger = logging.getLogger("celery.task_failure")


@task_failure.connect
def log_celery_task_failure(sender=None, task_id=None, exception=None, **kwargs):
    """Structured log when a Celery task exhausts retries or fails permanently."""
    task_name = getattr(sender, "name", None) or str(sender)
    logger.error(
        "celery_task_failure task=%s task_id=%s error=%s",
        task_name,
        task_id,
        exception,
        exc_info=True,
        extra={
            "celery_task": task_name,
            "celery_task_id": task_id,
        },
    )

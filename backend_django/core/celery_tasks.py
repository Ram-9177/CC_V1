"""Shared Celery task helpers for consistent retry and failure logging."""

from __future__ import annotations

import logging

from celery import Task, shared_task
from django.conf import settings


class ResilientTask(Task):
    """Task base that centralizes retry and failure logging behavior."""

    abstract = True
    ignore_result = True
    acks_late = True
    reject_on_worker_lost = True

    def retry_with_context(
        self,
        exc: Exception,
        *,
        context: str,
        countdown: int | None = None,
        max_retries: int | None = None,
    ):
        retry_limit = max_retries if max_retries is not None else getattr(
            self, 'max_retries', getattr(settings, 'CELERY_TASK_DEFAULT_MAX_RETRIES', 3)
        )
        retry_delay = countdown or min(
            2 ** max(self.request.retries, 0),
            getattr(settings, 'CELERY_TASK_RETRY_BACKOFF_MAX', 60),
        )
        logging.getLogger(self.name).warning(
            '%s failed; retrying attempt %s/%s in %ss: %s',
            context,
            self.request.retries + 1,
            retry_limit,
            retry_delay,
            exc,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        raise self.retry(exc=exc, countdown=retry_delay, max_retries=retry_limit)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logging.getLogger(self.name).error(
            'Task %s failed permanently after %s retries. args=%s kwargs=%s error=%s',
            self.name,
            self.request.retries,
            args,
            kwargs,
            exc,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        super().on_failure(exc, task_id, args, kwargs, einfo)


def resilient_shared_task(*task_args, max_retries: int | None = None, **task_kwargs):
    """Create a shared task with the standard resilient task base."""

    options = {
        'bind': True,
        'base': ResilientTask,
        'ignore_result': True,
    }
    if max_retries is not None:
        options['max_retries'] = max_retries
    options.update(task_kwargs)
    return shared_task(*task_args, **options)
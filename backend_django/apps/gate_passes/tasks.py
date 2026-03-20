"""Celery tasks for gate passes.

Replaces the management command auto_expire_gate_passes with a periodic task
that runs every 15 minutes via Celery Beat.
"""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    ignore_result=True,
    name='apps.gate_passes.tasks.auto_expire_gate_passes',
)
def auto_expire_gate_passes():
    """Expire approved gate passes whose entry_date has passed.

    Mirrors the logic in the management command but runs async via Celery Beat
    every 15 minutes instead of requiring a cron job.
    """
    from .models import GatePass

    now = timezone.now()
    expired_qs = GatePass.objects.filter(
        status__in=['approved', 'used'],
        entry_date__lt=now,
    )
    count = expired_qs.count()
    if count:
        expired_qs.update(status='expired', updated_at=now)
        logger.info(f"auto_expire_gate_passes: expired {count} gate passes")
    return count

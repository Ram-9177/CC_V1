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
    """Expire or escalate gate passes whose entry_date has passed.
    
    1. Approved but not used -> Expired (Student never left)
    2. Used / Outside but not returned -> Late Return (Student is still out)
    """
    from .models import GatePass
    from apps.notifications.service import NotificationService

    now = timezone.now()
    
    # 1. Approved but never used (Student stayed in)
    never_used_qs = GatePass.objects.filter(
        status='approved',
        entry_date__lt=now,
    )
    never_used_count = never_used_qs.count()
    if never_used_count:
        never_used_qs.update(status='expired', updated_at=now)
        logger.info(f"auto_expire_gate_passes: expired {never_used_count} never-used passes")

    # 2. Used/Outside but not returned (LATE RETURN)
    # Statuses 'used' and 'outside' both mean the student is currently out.
    late_qs = GatePass.objects.filter(
        status__in=['used', 'outside'],
        entry_date__lt=now,
    ).select_related('student', 'college')
    
    late_count = late_qs.count()
    if late_count:
        for gp in late_qs:
            gp.status = 'late_return'
            gp.updated_at = now
            gp.save(update_fields=['status', 'updated_at'])
            
            # Send Institutional Alerts
            notif_title = f"⚠️ Late Return: {gp.student.get_full_name() or gp.student.username}"
            notif_body = f"Student {gp.student.username} has not returned by {gp.entry_date.strftime('%H:%M')}. Pass type: {gp.get_pass_type_display()}."
            
            # Alert Wardens of the specific college
            NotificationService.send_to_role(
                role='warden',
                title=notif_title,
                message=notif_body,
                notif_type='warning',
                action_url=f"/admin/gate-passes?id={gp.id}",
                college_id=gp.college_id
            )
            
        logger.info(f"auto_expire_gate_passes: escalated {late_count} to late_return")

    return never_used_count + late_count

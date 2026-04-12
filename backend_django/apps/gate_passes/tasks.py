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

    Pending approval timeout policy:
    1. Pending > 12h -> remind warden + head_warden (once)
    2. Pending > 24h -> auto-expire and notify student

    1. Approved but not used -> Expired (Student never left)
    2. Used / Outside but not returned -> Late Return (Student is still out)
    """
    from .models import GatePass
    from apps.notifications.service import NotificationService

    now = timezone.now()

    # 0. Pending reminders and expiry windows
    reminder_cutoff = now - timezone.timedelta(hours=12)
    expiry_cutoff = now - timezone.timedelta(hours=24)

    reminded_count = 0
    pending_reminder_qs = GatePass.objects.filter(
        status='pending',
        created_at__lte=reminder_cutoff,
        created_at__gt=expiry_cutoff,
        pending_reminded_at__isnull=True,
    ).select_related('student', 'college')

    for gp in pending_reminder_qs:
        title = f"Pending Gate Pass >12h: {gp.student.get_full_name() or gp.student.username}"
        message = (
            f"Gate pass #{gp.id} has been pending approval for more than 12 hours. "
            f"Please review now."
        )
        NotificationService.send_to_roles(
            roles=['warden', 'head_warden'],
            title=title,
            message=message,
            notif_type='warning',
            action_url=f"/gate-passes?id={gp.id}",
            college_id=gp.college_id,
        )
        gp.pending_reminded_at = now
        gp.updated_at = now
        gp.save(update_fields=['pending_reminded_at', 'updated_at'])
        reminded_count += 1

    pending_expired_count = 0
    pending_expiry_qs = GatePass.objects.filter(
        status='pending',
        created_at__lte=expiry_cutoff,
    ).select_related('student', 'college')

    for gp in pending_expiry_qs:
        gp.status = 'expired'
        suffix = 'Auto-expired after 24 hours without approval.'
        remarks = (gp.approval_remarks or '').strip()
        gp.approval_remarks = f"{remarks} {suffix}".strip()
        gp.updated_at = now
        gp.save(update_fields=['status', 'approval_remarks', 'updated_at'])

        NotificationService.send(
            user=gp.student,
            title='Gate Pass Expired',
            message='Your pending gate pass request expired after 24 hours without approval.',
            notif_type='warning',
            action_url='/gate-passes',
            college=gp.college,
        )
        pending_expired_count += 1
    
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
    # Canonical outside state is 'out'; include legacy aliases for compatibility.
    late_qs = GatePass.objects.filter(
        status__in=['out', 'outside', 'used'],
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

    return reminded_count + pending_expired_count + never_used_count + late_count

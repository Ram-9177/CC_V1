"""
apps/complaints/tasks.py
========================
Celery periodic tasks for the Complaints module.

Registered tasks:
  - check_complaint_sla        → runs every 5 minutes
  - escalate_overdue_complaints → runs every 30 minutes (after SLA confirmed)

Worker start command (from backend_django/):
    celery -A hostelconnect worker -l info --concurrency=4

Beat start command:
    celery -A hostelconnect beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    name="apps.complaints.tasks.check_complaint_sla",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    ignore_result=True,
)
def check_complaint_sla(self):
    """
    Scan all open/in-progress complaints and flag any that have breached SLA.

    SLA thresholds (from Complaint.check_sla()):
        critical / high  → 24 hours
        medium           → 48 hours
        low              → 72 hours

    On breach:
        1. Sets is_overdue = True
        2. Broadcasts 'complaint.sla_breach' WS event to management
        3. Logs for audit trail

    Runs: every 5 minutes (see CELERY_BEAT_SCHEDULE in settings/base.py)
    """
    from .models import Complaint
    from core.event_service import emit_event

    logger.info("[SLA Task] Starting complaint SLA check...")

    try:
        # Deliberately scope to unresolved, not-yet-flagged complaints only
        # to avoid re-processing the same breached records on every tick.
        candidates = Complaint.objects.filter(
            status__in=["open", "in_progress"],
            is_overdue=False,       # Only newly breached ones
        ).select_related("student", "assigned_to")

        newly_overdue_ids = []

        for complaint in candidates:
            try:
                if complaint.check_sla():
                    complaint.is_overdue = True
                    complaint.save(update_fields=["is_overdue", "updated_at"])
                    newly_overdue_ids.append(complaint.id)
                    logger.warning(
                        "[SLA BREACH] Complaint #%s (%s severity, created %s) is now overdue.",
                        complaint.id,
                        complaint.severity,
                        complaint.created_at.strftime("%Y-%m-%d %H:%M"),
                    )

                    # Broadcast SLA breach event to management in real time
                    emit_event(
                        "complaint.sla_breach",
                        {
                            "id": complaint.id,
                            "severity": complaint.severity,
                            "status": complaint.status,
                            "title": complaint.title,
                            "is_overdue": True,
                            "resource": "complaint",
                        },
                        to_management=True,
                        user_id=None,  # no personal user target
                    )

            except Exception as complaint_err:
                logger.error(
                    "[SLA Task] Failed to process complaint #%s: %s",
                    complaint.id,
                    complaint_err,
                )

        count = len(newly_overdue_ids)
        logger.info(
            "[SLA Task] Done. %s complaint(s) newly flagged as overdue. IDs: %s",
            count,
            newly_overdue_ids or "none",
        )
        return {"newly_overdue": count, "ids": newly_overdue_ids}

    except Exception as exc:
        logger.error("[SLA Task] Task failed: %s", exc)
        self.retry(exc=exc)


@shared_task(
    name="apps.complaints.tasks.escalate_overdue_complaints",
    bind=True,
    max_retries=2,
    ignore_result=True,
)
def escalate_overdue_complaints(self):
    """
    For complaints already flagged as overdue and still unresolved:
    - Emit a 'complaint.escalated' event to the head_warden role group
    - Send a persistent in-app notification to the head_warden (if not sent today)

    Runs: every 30 minutes (see CELERY_BEAT_SCHEDULE in settings/base.py)
    """
    from .models import Complaint
    from core.event_service import emit_event
    from apps.notifications.service import NotificationService
    from .assignment import get_escalation_target
    from core.audit import log_action

    logger.info("[Escalation Task] Scanning overdue complaints...")

    try:
        overdue = Complaint.objects.filter(
            status__in=["open", "in_progress"],
            is_overdue=True,
        ).select_related("student", "college")

        count = overdue.count()
        if count == 0:
            logger.info("[Escalation Task] No overdue complaints at this time.")
            return {"escalated": 0}

        # Build a minimal summary for the notification
        summary_lines = []
        for c in overdue[:10]:  # Cap at 10 for notification brevity
            age_hours = round((timezone.now() - c.created_at).total_seconds() / 3600, 1)
            summary_lines.append(
                f"• #{c.id} [{c.severity.upper()}] {c.title} — {age_hours}h old"
            )

            # Auto-escalate: find the next authority and re-assign
            try:
                new_assignee = get_escalation_target(c)
                if new_assignee and c.assigned_to != new_assignee:
                    old_assignee_id = c.assigned_to_id
                    c.assigned_to = new_assignee
                    c.save(update_fields=["assigned_to", "updated_at"])
                    log_action(
                        new_assignee,
                        "UPDATE",
                        c,
                        changes={"assigned_to": [old_assignee_id, new_assignee.id], "reason": "sla_escalation"},
                    )
                    logger.info(
                        "[Escalation] Complaint #%s re-assigned to %s (%s) via SLA breach.",
                        c.id, new_assignee.username, new_assignee.role,
                    )
            except Exception as ea:
                logger.warning("[Escalation] Re-assign failed for #%s: %s", c.id, ea)

        summary = "\n".join(summary_lines)
        if count > 10:
            summary += f"\n...and {count - 10} more."

        # Broadcast bulk escalation event to management WS
        emit_event(
            "complaint.escalated",
            {
                "overdue_count": count,
                "resource": "complaint",
            },
            to_management=True,
        )

        # Persistent in-app notification to head_warden role
        try:
            NotificationService.send_to_role(
                "head_warden",
                f"⚠️ {count} Complaint(s) Overdue",
                f"The following complaints have breached SLA and require your attention:\n\n{summary}",
                "warning",
                "/complaints",
            )
            NotificationService.send_to_role(
                "warden",
                f"⚠️ {count} Complaint(s) Overdue",
                f"{count} open complaints have exceeded SLA. Please resolve or escalate.\n\n{summary}",
                "warning",
                "/complaints",
            )
        except Exception as notif_err:
            logger.warning("[Escalation Task] Notification send failed: %s", notif_err)

        logger.info("[Escalation Task] Escalated %s overdue complaint(s).", count)
        return {"escalated": count}

    except Exception as exc:
        logger.error("[Escalation Task] Task failed: %s", exc)
        self.retry(exc=exc)

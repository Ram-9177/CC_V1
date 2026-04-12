"""
apps/complaints/tasks.py
========================
Celery periodic tasks for Phase 4 SLA enforcement.
"""

import logging

from core.celery_tasks import resilient_shared_task
from .models import Complaint

logger = logging.getLogger(__name__)

@resilient_shared_task(name="apps.complaints.tasks.check_complaint_sla", max_retries=3)
def check_complaint_sla(self):
    """
    Flag newly breached complaints via ComplaintService.
    """
    try:
        logger.info("[SLA Task] Starting SLA breach check...")
        from .services.complaint_service import ComplaintService

        candidates = Complaint.objects.filter(
            status__in=["open", "assigned", "in_progress", "reopened"],
            is_overdue=False
        ).values_list('id', flat=True)

        breached_count = 0
        for cid in candidates:
            if ComplaintService.process_sla_check(cid):
                breached_count += 1

        return {"breached_count": breached_count}
    except Exception as exc:
        self.retry_with_context(exc, context='check_complaint_sla')


@resilient_shared_task(name="apps.complaints.tasks.escalate_overdue_complaints", max_retries=3)
def escalate_overdue_complaints(self):
    """
    Auto-escalate Breached Complaints via ComplaintService.
    """
    try:
        logger.info("[Escalation Task] Scanning breached complaints for routing...")
        from .services.complaint_service import ComplaintService

        overdue = Complaint.objects.filter(
            status__in=["open", "assigned", "in_progress", "reopened"],
            is_overdue=True
        ).exclude(escalation_level__gte=3).values_list('id', flat=True)

        escalated_count = 0
        for cid in overdue:
            if ComplaintService.escalate_complaint(cid):
                escalated_count += 1

        return {"escalated_count": escalated_count}
    except Exception as exc:
        self.retry_with_context(exc, context='escalate_overdue_complaints')

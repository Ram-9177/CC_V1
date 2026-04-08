from django.utils import timezone
from django.db import transaction
from core.services import BaseService
from apps.complaints.models import Complaint
from apps.notifications.service import NotificationService

class SLAEscalationService(BaseService):
    """
    God Level SLA Escalation Logic.
    Monitoring institutional commitments and auto-escalating breaches.
    """

    @classmethod
    @transaction.atomic
    def process_breaches(cls) -> int:
        """
        Scans all open complaints for SLA breaches and escalates accordingly.
        Returns the number of complaints escalated.
        """
        now = timezone.now()
        # Find all un-resolved complaints past their resolution time
        breached = Complaint.objects.select_for_update().filter(
            status__in=['open', 'assigned', 'in_progress', 'reopened'],
            expected_resolution_time__lt=now,
            is_overdue=False
        )

        escalated_count = 0
        for complaint in breached:
            # 1. Mark as overdue
            complaint.is_overdue = True
            
            # 2. Logic-based escalation level
            # Level 0 (None) -> 1 (Warden) -> 2 (Head Warden) -> 3 (Admin)
            new_level = min(3, complaint.escalation_level + 1)
            complaint.escalation_level = new_level
            complaint.save(update_fields=['is_overdue', 'escalation_level'])
            
            # 3. Emit forensic event
            cls.emit(
                event_name='complaint.sla_breach',
                payload={
                    'complaint_id': str(complaint.id),
                    'category': complaint.category,
                    'escalation_level': new_level,
                    'expected_time': complaint.expected_resolution_time.isoformat()
                },
                priority='high'
            )
            
            # 4. Trigger Internal Notification (to Warden/Management)
            # Notification logic would go here
            
            escalated_count += 1
            
        return escalated_count

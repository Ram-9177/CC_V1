"""Disciplinary app services."""
import logging
from django.utils import timezone
from apps.disciplinary.models import DisciplinaryAction
from apps.auth.models import User
from apps.notifications.service import NotificationService

logger = logging.getLogger(__name__)

class DisciplinaryService:
    """Service for reporting and managing disciplinary records."""
    
    @staticmethod
    def report_late_return(student_id: int, gate_pass_id: int, actual_entry_at, expected_entry_at):
        """Automatically log a late return disciplinary record."""
        try:
            student = User.objects.get(id=student_id)
            
            # Calculate severity based on delay
            delay = actual_entry_at - expected_entry_at
            severity = 'low'
            fine_amount = 0
            if delay.total_seconds() > 3600 * 2:  # > 2 hours
                severity = 'medium'
                fine_amount = 50.00
            if delay.total_seconds() > 3600 * 5:  # > 5 hours
                severity = 'high'
                fine_amount = 100.00
            
            description = (
                f"Automatic Late Return.\n"
                f"Expected: {expected_entry_at.strftime('%Y-%m-%d %H:%M')}\n"
                f"Actual: {actual_entry_at.strftime('%Y-%m-%d %H:%M')}\n"
                f"Delay: {str(delay).split('.')[0]}\n"
                f"GatePass ID: {gate_pass_id}"
            )
            
            action = DisciplinaryAction.objects.create(
                student=student,
                action_type='late',
                severity=severity,
                title=f"Late Return - {actual_entry_at.date()}",
                description=description,
                fine_amount=fine_amount
            )
            
            # Notify management
            msg = f"Late Return Action Logged: {student.get_full_name() or student.username} is delay by {str(delay).split('.')[0]}."
            NotificationService.send_to_role('warden', "🔴 Action Required: Late Return", msg, 'warning', '/violations')
            
            # Notify student
            notif_msg = "An automatic 'Late Return' record has been added to your profile."
            if fine_amount > 0:
                notif_msg += f" A fine of ₹{fine_amount} has been issued."
                
            NotificationService.send(
                student,
                "⚠️ Disciplinary Action Recorded",
                notif_msg,
                'alert'
            )
            
            return action
            
        except Exception as e:
            logger.error(f"DisciplinaryService.report_late_return failed: {e}")
            return None

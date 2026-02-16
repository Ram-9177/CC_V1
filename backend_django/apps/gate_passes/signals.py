from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import GatePass
from apps.users.models import Tenant
from apps.disciplinary.models import DisciplinaryAction

@receiver(post_save, sender=GatePass)
def check_late_return(sender, instance, created, **kwargs):
    """
    Check if a student returned late when GatePass is marked 'used'.
    If return is > 2 hours late (grace period), flag it.
    """
    if instance.status == 'used' and instance.actual_entry_at and instance.entry_date:
        # Calculate delay
        delay = instance.actual_entry_at - instance.entry_date
        delay_hours = delay.total_seconds() / 3600
        
        if delay_hours > 2:
            # Create Disciplinary Action automatically? 
            # Or just update Risk Score?
            # Design decision: Create a system-generated warning.
            
            # Check if action already exists to avoid duplicates
            exists = DisciplinaryAction.objects.filter(
                student=instance.student,
                title=f"Late Return - {instance.id}"
            ).exists()
            
            if not exists:
                severity = 'low'
                fine = 0
                if delay_hours > 24: 
                    severity = 'high'
                    fine = 500
                elif delay_hours > 12: 
                    severity = 'medium'
                    fine = 100
                
                DisciplinaryAction.objects.create(
                    student=instance.student,
                    action_type='late',
                    severity=severity,
                    title=f"Late Return - {instance.id}",
                    description=f"Returned {int(delay_hours)} hours late on pass {instance.qr_code}.",
                    fine_amount=fine,
                    action_taken_by=None # System
                )

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

@receiver(post_save, sender=GatePass)
def update_leave_status(sender, instance, **kwargs):
    """
    STEP 3: LEAVE STATUS lifecycle integration.
    Update linked LeaveApplication status based on GatePass scan movements.
    """
    if not instance.reason.startswith("Leave: "):
        return

    from apps.leaves.models import LeaveApplication
    # Identify the corresponding leave application
    leave = LeaveApplication.objects.filter(
        student=instance.student,
        status__in=['APPROVED', 'ACTIVE']
    ).order_by('-created_at').first()

    if leave:
        # If student exits (GatePass marked 'used' during check-out)
        if instance.status == 'used' and not instance.actual_entry_at:
            if leave.status != 'ACTIVE':
                leave.status = 'ACTIVE'
                leave.save(update_fields=['status'])
        
        # If student returns (GatePass marked 'expired' during check-in)
        elif instance.status == 'expired' and instance.actual_entry_at:
            if leave.status != 'COMPLETED':
                leave.status = 'COMPLETED'
                leave.save(update_fields=['status'])


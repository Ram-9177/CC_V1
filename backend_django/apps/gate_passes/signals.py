from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import GatePass, GateScan
from apps.disciplinary.models import DisciplinaryAction


def _active_room_label(user) -> str:
    allocation = (
        user.room_allocations.select_related('room')
        .filter(end_date__isnull=True)
        .first()
    )
    if not allocation or not allocation.room:
        return 'N/A'
    return allocation.room.room_number


@receiver(pre_save, sender=GatePass)
def capture_previous_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = (
        GatePass.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
    )

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


@receiver(post_save, sender=GatePass)
def broadcast_gatepass_realtime(sender, instance, created, **kwargs):
    """Broadcast new requests and status changes to role-targeted socket groups."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    now_iso = timezone.now().isoformat()

    if created:
        async_to_sync(channel_layer.group_send)(
            'gatepass_warden',
            {
                'type': 'new.gatepass',
                'gatepass_id': instance.id,
                'student_name': instance.student.get_full_name() or instance.student.username,
                'student_room': _active_room_label(instance.student),
                'pass_type': instance.pass_type,
                'reason': instance.reason,
                'scheduled_exit': instance.exit_date.isoformat() if instance.exit_date else None,
                'timestamp': now_iso,
            },
        )
        return

    previous_status = getattr(instance, '_previous_status', None)
    if instance.status not in {'approved', 'rejected'}:
        return
    if previous_status == instance.status:
        return

    status_payload = {
        'type': 'status.changed',
        'target': 'student',
        'gatepass_id': instance.id,
        'status': instance.status,
        'student_name': instance.student.get_full_name() or instance.student.username,
        'approved_by': (
            instance.approved_by.get_full_name() or instance.approved_by.username
            if instance.approved_by
            else ''
        ),
        'remarks': instance.approval_remarks,
        'valid_until': instance.entry_date.isoformat() if instance.entry_date else None,
        'timestamp': now_iso,
    }

    async_to_sync(channel_layer.group_send)(
        f'gatepass_student_{instance.student.id}',
        status_payload,
    )

    security_payload = {
        **status_payload,
        'target': 'security',
    }
    async_to_sync(channel_layer.group_send)('gatepass_security', security_payload)


@receiver(post_save, sender=GateScan)
def broadcast_gate_scan_realtime(sender, instance, created, **kwargs):
    if not created:
        return

    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    payload = {
        'type': 'gate.scan',
        'student_name': instance.student.get_full_name() or instance.student.username,
        'direction': instance.direction,
        'scan_time': instance.scan_time.isoformat() if instance.scan_time else timezone.now().isoformat(),
        'location': instance.location or 'Main Gate',
    }

    async_to_sync(channel_layer.group_send)('gatepass_security', payload)
    async_to_sync(channel_layer.group_send)('dashboard_admin', payload)


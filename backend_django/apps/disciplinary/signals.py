"""Disciplinary action signals for real-time updates."""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import DisciplinaryAction
from websockets.broadcast import broadcast_to_updates_user, broadcast_to_management


@receiver(post_save, sender=DisciplinaryAction)
def broadcast_disciplinary_action(sender, instance: DisciplinaryAction, created: bool, **kwargs):
    """Broadcast disciplinary action events to relevant users."""
    
    payload = {
        'id': instance.id,
        'student_id': instance.student.id if instance.student else None,
        'action_type': instance.action_type,
        'severity': instance.severity,
        'title': instance.title,
        'description': instance.description,
        'fine_amount': str(instance.fine_amount),
        'is_paid': instance.is_paid,
        'paid_at': instance.paid_date.isoformat() if instance.paid_date else None,
        'created_at': instance.created_at.isoformat() if instance.created_at else None,
        'updated_at': instance.updated_at.isoformat() if hasattr(instance, 'updated_at') and instance.updated_at else None,
        'resource': 'disciplinary',
    }

    # Notify the student about the action
    if instance.student:
        broadcast_to_updates_user(instance.student.id, 'disciplinary', payload)

    # Broadcast to management staff for awareness
    broadcast_to_management('disciplinary', payload)

"""Notification signals.

Send real-time notification events over the notifications WebSocket when a
Notification row is created.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification
from websockets.broadcast import broadcast_to_notifications_user


@receiver(post_save, sender=Notification)
def broadcast_notification_created(sender, instance: Notification, created: bool, **kwargs):
    if not created:
        return

    payload = {
        'id': instance.id,
        'title': instance.title,
        'message': instance.message,
        'notification_type': instance.notification_type,
        'action_url': instance.action_url,
        # Ensure payload is JSON serializable for WebSocket delivery.
        'created_at': instance.created_at.isoformat() if instance.created_at else None,
    }

    broadcast_to_notifications_user(instance.recipient_id, payload)

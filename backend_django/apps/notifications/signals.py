"""Notification signals.

Send real-time notification events over the notifications WebSocket when a
Notification row is created.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db import transaction
from core import cache_keys as ck

from .models import Notification
from websockets.broadcast import broadcast_to_notifications_user, broadcast_to_updates_user, notify_unread_count_changed


@receiver(post_save, sender=Notification)
def broadcast_notification_created(sender, instance: Notification, created: bool, **kwargs):
    if not created:
        return

    if not instance.recipient_id:
        return

    cache.delete(f"{ck.permissions_user(instance.recipient_id)}:notif_unread")

    unread_count = Notification.objects.filter(
        recipient_id=instance.recipient_id,
        is_read=False,
    ).count()

    payload = {
        'title': instance.title,
        'message': instance.message,
        'notif_type': instance.notification_type,
        'url': instance.action_url or '',
        'unread_count': unread_count,
        'timestamp': (instance.created_at or timezone.now()).isoformat(),
        'id': str(instance.id),
    }

    def _broadcast_live() -> None:
        broadcast_to_notifications_user(instance.recipient_id, payload)
        broadcast_to_updates_user(instance.recipient_id, 'notification_new', payload)
        notify_unread_count_changed(instance.recipient_id, 1)

    transaction.on_commit(_broadcast_live)

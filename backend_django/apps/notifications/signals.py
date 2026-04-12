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
from core import cache_keys as ck

from .models import Notification


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

    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        f'notifications_{instance.recipient_id}',
        {
            'type': 'push.notification',
            'title': instance.title,
            'message': instance.message,
            'notif_type': instance.notification_type,
            'url': instance.action_url or '',
            'unread_count': unread_count,
            'timestamp': (instance.created_at or timezone.now()).isoformat(),
        },
    )

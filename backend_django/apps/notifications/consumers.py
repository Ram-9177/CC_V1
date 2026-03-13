"""WebSocket consumer for personal live notifications."""

import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from apps.notifications.models import Notification


class NotificationConsumer(AsyncWebsocketConsumer):
    """Streams personal notification events and unread count."""

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.group_name = f'notifications_{self.user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        unread_count = await self.get_unread_count(self.user.id)
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': '',
            'message': '',
            'notif_type': 'info',
            'url': '',
            'unread_count': unread_count,
            'timestamp': None,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(getattr(self, 'group_name', ''), self.channel_name)

    async def push_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': event.get('title', ''),
            'message': event.get('message', ''),
            'notif_type': event.get('notif_type', 'info'),
            'url': event.get('url', ''),
            'unread_count': event.get('unread_count', 0),
            'timestamp': event.get('timestamp'),
        }))

    @sync_to_async
    def get_unread_count(self, user_id: int) -> int:
        return Notification.objects.filter(recipient_id=user_id, is_read=False).count()

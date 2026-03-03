"""WebSocket consumers for real-time features."""

import json
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from core.constants import BROADCAST_MANAGEMENT


class HostelConnectConsumer(AsyncWebsocketConsumer):
    """
    Unified WebSocket consumer (Single-Socket Architecture).
    Consolidates Notifications, Data Updates, and Presence into one connection
    to optimize for Free Tier limits and high-latency mobile networks.
    """
    
    async def connect(self):
        """Handle unified WebSocket connection."""
        self.user = self.scope.get('user', AnonymousUser())
        self.user_id = self.user.id if self.user.is_authenticated else None
        
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4401)
            return

        # 1. Setup Groups
        self.groups_to_join = [
            f'updates_{self.user_id}',         # Personal updates & notifications
            f'notifications_{self.user_id}',   # Legacy notifications
            f'role_{self.user.role}',          # Role-based broadcasting
            'presence_all',                    # Global presence tracking
        ]

        # Staff/Management Groups
        user_role = getattr(self.user, 'role', None)
        if user_role in BROADCAST_MANAGEMENT:
            self.groups_to_join.append('management')

        # Join all groups
        for group in self.groups_to_join:
            await self.channel_layer.group_add(group, self.channel_name)
        
        await self.accept()

        # 2. Notify presence
        await self.channel_layer.group_send(
            'presence_all',
            {
                'type': 'user_status_changed',
                'user_id': self.user_id,
                'status': 'online'
            }
        )
    
    async def disconnect(self, code):
        """Clean up all group memberships and notify offline status."""
        if not self.user_id:
            return

        # 1. Notify others that user is offline
        await self.channel_layer.group_send(
            'presence_all',
            {
                'type': 'user_status_changed',
                'user_id': self.user_id,
                'status': 'offline'
            }
        )

        # 2. Leave all groups
        for group in getattr(self, 'groups_to_join', []):
            await self.channel_layer.group_discard(group, self.channel_name)
    
    async def receive(self, text_data):
        """Handle incoming control messages (ping, subscribe, unsubscribe)."""
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')
            
            if msg_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                return

            if msg_type == 'subscribe':
                resource = data.get('resource')
                r_id = data.get('id')
                if resource and r_id:
                    group = f'{resource}_{r_id}_updates'
                    await self.channel_layer.group_add(group, self.channel_name)
                    # Track for clean disconnect
                    self.groups_to_join.append(group)
                    await self.send(text_data=json.dumps({'type': 'subscribed', 'resource': resource, 'id': r_id}))

            elif msg_type == 'unsubscribe':
                resource = data.get('resource')
                r_id = data.get('id')
                if resource and r_id:
                    group = f'{resource}_{r_id}_updates'
                    await self.channel_layer.group_discard(group, self.channel_name)
                    if group in self.groups_to_join: self.groups_to_join.remove(group)
                    await self.send(text_data=json.dumps({'type': 'unsubscribed', 'resource': resource, 'id': r_id}))

        except Exception:
            pass # Silently drop invalid control messages

    # --- Event Handlers (Fanned in from Groups) ---

    async def notification_received(self, event):
        """Legacy compatibility for dedicated notification messages."""
        await self.send(text_data=json.dumps({'type': 'notification', 'data': event['data']}))

    async def user_status_changed(self, event):
        """Presence update handler."""
        await self.send(text_data=json.dumps({
            'type': 'user_status_changed',
            'user_id': event['user_id'],
            'status': event['status']
        }))

    def __getattr__(self, name):
        """
        Dynamically forward any custom group event (gatepass_updated, etc.)
        This enables unlimited feature growth without modifying this consumer.
        """
        if name.startswith('_') or name in {'user', 'scope', 'channel_layer', 'channel_name'}:
            raise AttributeError(name)

        async def _handler(event):
            await self.send(text_data=json.dumps({
                'type': name,
                'data': event.get('data'),
            }))
        return _handler

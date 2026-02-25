"""WebSocket consumers for real-time features."""

import json
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from core.constants import BROADCAST_MANAGEMENT


class NotificationConsumer(AsyncWebsocketConsumer):
    """Consumer for real-time notifications."""
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user', AnonymousUser())
        self.user_id = self.user.id if self.user.is_authenticated else None
        self.group_name = None
        
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4401)
            return
        
        # Create group name based on user ID
        self.group_name = f'notifications_{self.user_id}'
        
        # Add to group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        if getattr(self, 'group_name', None):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def notification_received(self, event):
        """Send notification to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
    
    async def user_connected(self, event):
        """Broadcast user connection."""
        await self.send(text_data=json.dumps({
            'type': 'user_connected',
            'data': {
                'user_id': event['user_id'],
                'message': event['message']
            }
        }))


class RealtimeUpdatesConsumer(AsyncWebsocketConsumer):
    """Consumer for real-time data updates (rooms, meals, attendance, etc.)."""

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user', AnonymousUser())
        self.group_name = None
        self.role_group_name = None
        self.management_group = None
        
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4401)
            return
        
        # Room/resource updates group
        self.group_name = f'updates_{self.user.id}'
        # Role group for fan-out events (must only use valid group-name chars)
        self.role_group_name = f'role_{self.user.role}'
        
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.channel_layer.group_add(
            self.role_group_name,
            self.channel_name
        )

        # Staff-wide fan-out group (used by broadcast_to_management).
        user_role = getattr(self.user, 'role', None)
        if user_role in BROADCAST_MANAGEMENT:
            self.management_group = 'management'
            await self.channel_layer.group_add(
                self.management_group,
                self.channel_name
            )
        
        await self.accept()
    
    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        if getattr(self, 'group_name', None):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        if getattr(self, 'role_group_name', None):
            await self.channel_layer.group_discard(
                self.role_group_name,
                self.channel_name
            )
        if getattr(self, 'management_group', None):
            await self.channel_layer.group_discard(
                self.management_group,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Handle incoming message."""
        try:
            data = json.loads(text_data)
            event_type = data.get('type')

            if event_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                return

            if event_type == 'subscribe':
                # Subscribe to specific resource updates
                resource = data.get('resource')
                resource_id = data.get('id')
                
                if resource and resource_id:
                    group_name = f'{resource}_{resource_id}_updates'
                    await self.channel_layer.group_add(
                        group_name,
                        self.channel_name
                    )
                    
                    await self.send(text_data=json.dumps({
                        'type': 'subscribed',
                        'resource': resource,
                        'id': resource_id
                    }))

            if event_type == 'unsubscribe':
                resource = data.get('resource')
                resource_id = data.get('id')
                if resource and resource_id:
                    group_name = f'{resource}_{resource_id}_updates'
                    await self.channel_layer.group_discard(group_name, self.channel_name)
                    await self.send(text_data=json.dumps({
                        'type': 'unsubscribed',
                        'resource': resource,
                        'id': resource_id
                    }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def data_updated(self, event):
        """Send data update to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'data_updated',
            'resource': event.get('resource'),
            'data': event.get('data')
        }))

    def __getattr__(self, name):
        """
        Forward any custom group event (e.g. gatepass_updated, room_allocated, etc.)
        to the client in a consistent {type, data} envelope.

        This keeps the backend flexible while the frontend subscribes by event name.
        """
        # Never treat internal/private attribute access as an event handler.
        if name.startswith('_'):
            raise AttributeError(name)

        if name in {
            'user',
            'group_name',
            'role_group_name',
            'presence_group',
            'scope',
            'channel_layer',
            'channel_name',
        }:
            raise AttributeError(name)

        if not re.fullmatch(r'[a-z][a-z0-9_]*', name):
            raise AttributeError(name)

        async def _handler(event):
            await self.send(text_data=json.dumps({
                'type': name,
                'data': event.get('data'),
            }))

        return _handler


class PresenceConsumer(AsyncWebsocketConsumer):
    """Consumer for tracking user presence (online status)."""
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user', AnonymousUser())
        self.presence_group = 'presence_all'
        
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4401)
            return
        
        await self.channel_layer.group_add(
            self.presence_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Notify others that user is online
        await self.channel_layer.group_send(
            self.presence_group,
            {
                'type': 'user_status_changed',
                'user_id': self.user.id,
                'status': 'online'
            }
        )
    
    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        if not getattr(self, 'user', None) or not self.user.is_authenticated:
            return
        if not getattr(self, 'presence_group', None):
            return

        await self.channel_layer.group_send(
            self.presence_group,
            {
                'type': 'user_status_changed',
                'user_id': self.user.id,
                'status': 'offline'
            }
        )
        
        await self.channel_layer.group_discard(
            self.presence_group,
            self.channel_name
        )
    
    async def user_status_changed(self, event):
        """Send user status change to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'user_status_changed',
            'user_id': event['user_id'],
            'status': event['status']
        }))

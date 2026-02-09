"""WebSocket consumers for real-time features."""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    """Consumer for real-time notifications."""
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope['user']
        self.user_id = self.user.id if self.user.is_authenticated else None
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # Create group name based on user ID
        self.group_name = f'notifications_{self.user_id}'
        
        # Add to group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Notify user is online
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'user_connected',
                'user_id': self.user_id,
                'message': 'Connected to notifications'
            }
        )
    
    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        if self.user.is_authenticated:
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
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
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
        
        await self.accept()
    
    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        await self.channel_layer.group_discard(
            self.role_group_name,
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
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.presence_group = 'presence_all'
        
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

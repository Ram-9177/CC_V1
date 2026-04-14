"""WebSocket consumer for personal live notifications with resilience."""

import json
import logging
import time
import asyncio

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from apps.notifications.models import Notification
from core.websocket_resilience import (
    WebSocketQueueManager,
    WebSocketHeartbeat,
    ConnectionStateTracker,
    ClientEventLog,
)

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """Streams personal notification events and unread count with resilience."""

    # Heartbeat configuration
    HEARTBEAT_INTERVAL = 30  # seconds
    MAX_CONSECUTIVE_MISSED_PONGS = 3

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.group_name = f'notifications_{self.user.id}'
        
        # Initialize resilience managers
        self.queue_manager = WebSocketQueueManager(self.user.id)
        self.heartbeat = WebSocketHeartbeat(self.user.id)
        self.event_log = ClientEventLog(self.user.id)
        
        # Mark user as connected
        ConnectionStateTracker.set_state(self.user.id, ConnectionStateTracker.STATE_CONNECTED)
        
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send initial state
        unread_count = await self.get_unread_count(self.user.id)
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'user_id': self.user.id,
            'unread_count': unread_count,
            'timestamp': time.time(),
        }))
        
        # Start heartbeat task
        self.heartbeat_task = asyncio.create_task(self._run_heartbeat())
        
        # Log connection event
        self.event_log.log_event('connected', {'user_id': self.user.id})
        logger.info(f"User {self.user.id} connected via WebSocket")

    async def disconnect(self, close_code):
        """Handle disconnection with graceful state management."""
        try:
            # Cancel heartbeat task
            if hasattr(self, 'heartbeat_task'):
                self.heartbeat_task.cancel()
                try:
                    await self.heartbeat_task
                except asyncio.CancelledError:
                    pass
            
            # Mark user as disconnected
            ConnectionStateTracker.set_state(self.user.id, ConnectionStateTracker.STATE_DISCONNECTED)
            
            # Log disconnection event
            self.event_log.log_event('disconnected', {'close_code': close_code})
            
            # Remove from channel group
            await self.channel_layer.group_discard(
                getattr(self, 'group_name', ''),
                self.channel_name
            )
            
            logger.info(f"User {self.user.id} disconnected (code: {close_code})")
        except Exception as e:
            logger.error(f"Error during disconnect for user {self.user.id}: {e}")

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages with heartbeat and resilience."""
        if not text_data:
            return
        
        try:
            payload = json.loads(text_data)
        except Exception as e:
            logger.warning(f"Failed to parse message from user {self.user.id}: {e}")
            return
        
        msg_type = payload.get('type')
        
        # Handle heartbeat ping/pong
        if msg_type == 'ping':
            self.heartbeat.record_pong()
            await self.send(text_data=json.dumps({
                'type': 'pong',
                'timestamp': time.time(),
            }))
            self.event_log.log_event('pong_sent')
            return
        
        # Handle reconnection sync request
        if msg_type == 'sync_pending':
            pending = self.queue_manager.get_pending()
            await self.send(text_data=json.dumps({
                'type': 'sync_status',
                'pending_count': len(pending),
                'timestamp': time.time(),
            }))
            self.event_log.log_event('sync_requested', {'pending_count': len(pending)})
            return
        
        # Log other message types
        self.event_log.log_event('message_received', {'type': msg_type})

    async def push_notification(self, event):
        """Push notification to connected client."""
        try:
            await self.send(text_data=json.dumps({
                'type': 'notification',
                'title': event.get('title', ''),
                'message': event.get('message', ''),
                'notif_type': event.get('notif_type', 'info'),
                'url': event.get('url', ''),
                'unread_count': event.get('unread_count', 0),
                'timestamp': event.get('timestamp'),
            }))
            self.event_log.log_event('notification_sent', {'title': event.get('title')})
        except Exception as e:
            logger.error(f"Failed to push notification to user {self.user.id}: {e}")

    async def _run_heartbeat(self):
        """Send periodic heartbeat pings to detect connection loss."""
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                
                # Send ping
                self.heartbeat.send_ping()
                await self.send(text_data=json.dumps({
                    'type': 'ping',
                    'timestamp': time.time(),
                }))
                
                # Check if connection alive
                missed = self.heartbeat.get_missed_pings()
                if missed >= self.MAX_CONSECUTIVE_MISSED_PONGS:
                    logger.warning(
                        f"User {self.user.id} missed {missed} pong responses, "
                        "client should trigger reconnection"
                    )
                    self.event_log.log_event('missed_pongs', {'count': missed})
        
        except asyncio.CancelledError:
            logger.debug(f"Heartbeat task cancelled for user {self.user.id}")
        except Exception as e:
            logger.error(f"Heartbeat error for user {self.user.id}: {e}")

    @sync_to_async
    def get_unread_count(self, user_id: int) -> int:
        return Notification.objects.filter(recipient_id=user_id, is_read=False).count()


class BroadcastNotificationConsumer(AsyncWebsocketConsumer):
    """Broadcast demo consumer with resilience: group ``notifications``."""

    async def connect(self):
        self.group_name = 'notifications'
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(f"Broadcast consumer connected to group: {self.group_name}")
        except Exception as e:
            logger.error(f"Failed to connect broadcast consumer: {e}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )
            logger.debug(f"Broadcast consumer disconnected (code: {close_code})")
        except Exception as e:
            logger.error(f"Error during broadcast disconnect: {e}")

    async def receive(self, text_data=None, bytes_data=None):
        """Receive and broadcast messages to all subscribers."""
        if not text_data:
            return
        
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse broadcast message: {e}")
            return
        
        try:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'send_notification',
                    'message': data.get('message', ''),
                    'timestamp': time.time(),
                },
            )
            logger.debug(f"Message broadcast to {self.group_name}")
        except Exception as e:
            logger.error(f"Failed to broadcast message: {e}")

    async def send_notification(self, event):
        """Handle incoming events from channel layer and send to client."""
        try:
            await self.send(text_data=json.dumps({
                'type': 'broadcast',
                'message': event.get('message', ''),
                'timestamp': event.get('timestamp'),
            }))
        except Exception as e:
            logger.error(f"Failed to send broadcast notification: {e}")

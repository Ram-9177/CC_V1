"""
WebSocket Resilience System - Handles connection loss with reconnection,
request queueing, and state synchronization.
"""

import logging
import json
import time
from typing import Optional, Callable, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from django.core.cache import cache

logger = logging.getLogger(__name__)


@dataclass
class PendingRequest:
    """Represents a request pending delivery via WebSocket."""
    id: str
    action: str
    payload: dict
    timestamp: float
    retries: int = 0
    max_retries: int = 3
    
    def to_dict(self):
        return asdict(self)
    
    def is_expired(self, max_age=3600):
        """Check if request has expired (default 1 hour)."""
        return time.time() - self.timestamp > max_age


class WebSocketQueueManager:
    """Manage pending WebSocket requests during disconnection."""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.queue_key = f'ws_queue:{user_id}'
        self.checkpoint_key = f'ws_checkpoint:{user_id}'
    
    def enqueue(self, action: str, payload: dict) -> str:
        """Queue a request for later delivery.
        
        Args:
            action: Action type (e.g., 'mark_attendance', 'create_complaint')
            payload: Request data
            
        Returns:
            Request ID for tracking
        """
        request_id = f"{self.user_id}:{int(time.time() * 1000)}"
        
        request = PendingRequest(
            id=request_id,
            action=action,
            payload=payload,
            timestamp=time.time(),
        )
        
        try:
            # Get existing queue
            queue_json = cache.get(self.queue_key, '[]')
            queue = json.loads(queue_json)
            
            # Add new request
            queue.append(request.to_dict())
            
            # Persist (TTL 24 hours)
            cache.set(self.queue_key, json.dumps(queue), 86400)
            
            logger.info(f"Queued request {request_id} for user {self.user_id}: {action}")
            return request_id
        except Exception as e:
            logger.error(f"Failed to enqueue request for user {self.user_id}: {e}")
            raise
    
    def get_pending(self) -> List[PendingRequest]:
        """Get all pending requests."""
        try:
            queue_json = cache.get(self.queue_key, '[]')
            queue = json.loads(queue_json)
            
            # Filter expired requests
            valid_requests = [
                PendingRequest(**item) for item in queue
                if not PendingRequest(**item).is_expired()
            ]
            
            return valid_requests
        except Exception as e:
            logger.error(f"Failed to get pending requests for user {self.user_id}: {e}")
            return []
    
    def mark_delivered(self, request_id: str):
        """Mark request as delivered."""
        try:
            queue_json = cache.get(self.queue_key, '[]')
            queue = json.loads(queue_json)
            
            # Remove delivered request
            queue = [
                item for item in queue
                if item.get('id') != request_id
            ]
            
            cache.set(self.queue_key, json.dumps(queue), 86400)
            logger.info(f"Marked request {request_id} as delivered")
        except Exception as e:
            logger.error(f"Failed to mark request {request_id} as delivered: {e}")
    
    def clear_queue(self):
        """Clear all pending requests."""
        try:
            cache.delete(self.queue_key)
            logger.info(f"Cleared queue for user {self.user_id}")
        except Exception as e:
            logger.error(f"Failed to clear queue for user {self.user_id}: {e}")
    
    def set_checkpoint(self, checkpoint_id: str):
        """Set synchronization checkpoint."""
        try:
            cache.set(
                self.checkpoint_key,
                {
                    'checkpoint_id': checkpoint_id,
                    'timestamp': time.time(),
                },
                86400  # TTL 24 hours
            )
        except Exception as e:
            logger.warning(f"Failed to set checkpoint for user {self.user_id}: {e}")
    
    def get_checkpoint(self) -> Optional[dict]:
        """Get last synchronization checkpoint."""
        try:
            return cache.get(self.checkpoint_key)
        except Exception as e:
            logger.warning(f"Failed to get checkpoint for user {self.user_id}: {e}")
            return None


class WebSocketHeartbeat:
    """Manage WebSocket heartbeat and keepalive."""
    
    PING_INTERVAL = 30  # seconds
    PONG_TIMEOUT = 10  # seconds
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.heartbeat_key = f'ws_heartbeat:{user_id}'
        self.last_pong_key = f'ws_last_pong:{user_id}'
    
    def send_ping(self) -> bool:
        """Record ping sent."""
        try:
            cache.set(self.heartbeat_key, time.time(), 60)
            return True
        except Exception as e:
            logger.warning(f"Failed to record ping for user {self.user_id}: {e}")
            return False
    
    def record_pong(self):
        """Record pong received."""
        try:
            cache.set(self.last_pong_key, time.time(), 60)
        except Exception as e:
            logger.warning(f"Failed to record pong for user {self.user_id}: {e}")
    
    def is_alive(self) -> bool:
        """Check if connection is alive based on heartbeat."""
        try:
            last_pong = cache.get(self.last_pong_key)
            if last_pong is None:
                return False
            
            # Connection is alive if pong received in last PONG_TIMEOUT seconds
            return time.time() - last_pong < self.PONG_TIMEOUT
        except Exception as e:
            logger.warning(f"Failed to check if connection alive for user {self.user_id}: {e}")
            return False
    
    def get_missed_pings(self) -> int:
        """Get number of missed ping responses."""
        try:
            last_ping = cache.get(self.heartbeat_key)
            last_pong = cache.get(self.last_pong_key)
            
            if last_ping is None or last_pong is None:
                return 0
            
            # Calculate number of intervals where ping was sent but no pong
            return max(0, int((last_ping - last_pong) / self.PING_INTERVAL))
        except Exception as e:
            logger.warning(f"Failed to get missed pings for user {self.user_id}: {e}")
            return 0


class ConnectionStateTracker:
    """Track WebSocket connection state for all users."""
    
    STATE_CONNECTED = 'connected'
    STATE_DISCONNECTED = 'disconnected'
    STATE_DEGRADED = 'degraded'  # Slow/unreliable connection
    
    @staticmethod
    def set_state(user_id: int, state: str):
        """Set connection state."""
        try:
            cache.set(f'ws_state:{user_id}', {
                'state': state,
                'timestamp': time.time(),
                'channel': f'notifications_{user_id}',
            }, 3600)
        except Exception as e:
            logger.warning(f"Failed to set connection state for user {user_id}: {e}")
    
    @staticmethod
    def get_state(user_id: int) -> Optional[dict]:
        """Get connection state."""
        try:
            return cache.get(f'ws_state:{user_id}')
        except Exception as e:
            logger.warning(f"Failed to get connection state for user {user_id}: {e}")
            return None
    
    @staticmethod
    def is_connected(user_id: int) -> bool:
        """Check if user is currently connected."""
        state = ConnectionStateTracker.get_state(user_id)
        return state and state.get('state') == ConnectionStateTracker.STATE_CONNECTED


class ReconnectionStrategy:
    """Manage WebSocket reconnection attempts."""
    
    # Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
    BASE_DELAY = 1  # seconds
    MAX_DELAY = 32  # seconds
    MAX_RETRIES = 10
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.state_key = f'ws_reconnect:{user_id}'
    
    def get_next_delay(self) -> int:
        """Get next reconnection delay with exponential backoff."""
        try:
            state = cache.get(self.state_key, {'retries': 0})
            retries = state.get('retries', 0)
            
            if retries >= self.MAX_RETRIES:
                logger.warning(f"Max reconnection attempts reached for user {self.user_id}")
                return -1  # Give up
            
            # Calculate delay: 1s * 2^(retries), capped at MAX_DELAY
            delay = min(self.BASE_DELAY * (2 ** retries), self.MAX_DELAY)
            
            # Increment retry count
            state['retries'] = retries + 1
            state['last_attempt'] = time.time()
            cache.set(self.state_key, state, 3600)
            
            return delay
        except Exception as e:
            logger.error(f"Failed to get reconnection delay for user {self.user_id}: {e}")
            return self.BASE_DELAY
    
    def reset(self):
        """Reset reconnection state on successful connection."""
        try:
            cache.delete(self.state_key)
            logger.info(f"Reconnection state reset for user {self.user_id}")
        except Exception as e:
            logger.warning(f"Failed to reset reconnection state for user {self.user_id}: {e}")


class WebSocketSyncManager:
    """Manage synchronization of pending requests after reconnection."""
    
    @staticmethod
    def sync_pending_requests(user_id: int, sync_callback: Callable) -> dict:
        """Synchronize all pending requests after reconnection.
        
        Args:
            user_id: User ID
            sync_callback: Callback to execute each request (async function)
            
        Returns:
            Sync result summary
        """
        queue_manager = WebSocketQueueManager(user_id)
        pending = queue_manager.get_pending()
        
        result = {
            'total': len(pending),
            'delivered': 0,
            'failed': 0,
            'expired': 0,
            'requests': [],
        }
        
        for request in pending:
            try:
                if request.is_expired():
                    result['expired'] += 1
                    queue_manager.mark_delivered(request.id)
                    logger.info(f"Expired request {request.id} removed")
                    continue
                
                # Execute request synchronously or queue for async
                logger.info(f"Syncing request {request.id}: {request.action}")
                
                # This would be called in the actual Django view/consumer
                # sync_callback(request)
                
                result['requests'].append({
                    'id': request.id,
                    'action': request.action,
                    'status': 'pending_sync',
                })
                
            except Exception as e:
                logger.error(f"Failed to sync request {request.id}: {e}")
                result['failed'] += 1
        
        return result


# Client-side event tracking (helpful for debugging)
class ClientEventLog:
    """Track client-side WebSocket events for debugging."""
    
    MAX_EVENTS = 100
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.log_key = f'ws_events:{user_id}'
    
    def log_event(self, event_type: str, details: dict = None):
        """Log a WebSocket event."""
        try:
            event = {
                'type': event_type,
                'timestamp': time.time(),
                'details': details or {},
            }
            
            # Get existing log
            log_json = cache.get(self.log_key, '[]')
            log = json.loads(log_json)
            
            # Keep only last N events
            log = log[-(self.MAX_EVENTS - 1):]
            log.append(event)
            
            cache.set(self.log_key, json.dumps(log), 3600)
        except Exception as e:
            logger.debug(f"Failed to log event for user {self.user_id}: {e}")
    
    def get_events(self) -> List[dict]:
        """Get all logged events."""
        try:
            log_json = cache.get(self.log_key, '[]')
            return json.loads(log_json)
        except Exception as e:
            logger.debug(f"Failed to get events for user {self.user_id}: {e}")
            return []

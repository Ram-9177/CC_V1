"""
Utility functions for broadcasting WebSocket events to connected clients.

PRODUCTION-SAFE: All broadcast failures are logged and handled gracefully.
"""

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
from core.constants import UserRoles

logger = logging.getLogger(__name__)


def broadcast_to_group(group_name: str, event_type: str, data: dict) -> bool:
    """
    Broadcast an event to all clients in a specific group.
    
    SAFETY: This function NEVER raises exceptions. It returns True/False for success.
    Failed broadcasts are logged but do NOT crash the caller.
    
    Args:
        group_name: The channel group name (e.g., 'updates_123')
        event_type: Type of event (e.g., 'data_updated', 'notification_received')
        data: Event data to send
    
    Returns:
        bool: True if broadcast succeeded, False otherwise
    """
    try:
        channel_layer = get_channel_layer()
        
        if not channel_layer:
            logger.warning(
                f"Channel layer unavailable - broadcast skipped: {event_type} to {group_name}"
            )
            return False
        
        # Send the message
        async_to_sync(channel_layer.group_send)(
            group_name, 
            {'type': event_type, 'data': data}
        )
        
        # FIX #5: Success logs removed (log flood protection for free tier)
        return True
        
    except Exception as e:
        # CRITICAL: Log but DO NOT re-raise
        logger.error(
            f"WebSocket broadcast FAILED: {event_type} → {group_name}",
            exc_info=True,
            extra={
                'group': group_name,
                'event_type': event_type,
                'error': str(e),
            }
        )
        return False


def broadcast_to_updates_user(user_id: int, event_type: str, data: dict):
    """
    Broadcast an event to a specific user (updates socket).
    
    Args:
        user_id: The user's ID
        event_type: Type of event
        data: Event data to send
    """
    broadcast_to_group(f'updates_{user_id}', event_type, data)


def broadcast_to_notifications_user(user_id: int, data: dict):
    """
    Send an in-app notification event to a specific user.

    Bandwidth optimization:
    Use the user's updates channel so clients can run with a single socket.
    
    Args:
        user_id: The user's ID
        data: Notification payload
    """
    # Primary: updates socket (single-socket clients)
    broadcast_to_group(f'updates_{user_id}', 'notification', data)
    # Back-compat: dedicated notifications socket
    broadcast_to_group(f'notifications_{user_id}', 'notification_received', data)


def broadcast_to_role(role: str, event_type: str, data: dict) -> bool:
    """
    Broadcast an event to all clients connected under a role group (updates socket).
    
    Returns True if broadcast succeeded, False otherwise.
    """
    # Role fan-out is handled via `role_{role}` groups. Broad staff fan-out should use
    # `broadcast_to_management()` so we don't leak role-specific events to all staff.
    return broadcast_to_group(f'role_{role}', event_type, data)


def broadcast_to_management(event_type: str, data: dict):
    """
    Broadcast an event to all management users in a single Redis call.
    """
    broadcast_to_group('management', event_type, data)


def notify_gatepass_updated(gatepass):
    """Notify relevant users when a gate pass is updated."""
    # Notify the student who created the gate pass
    broadcast_to_updates_user(
        gatepass.student.id,
        'gatepass_updated',
        {
            'id': gatepass.id,
            'status': gatepass.status,
            'resource': 'gatepass',
        }
    )
    
    # Broadcast to gate-related staff (use centralized constant)
    for role in UserRoles.BROADCAST_GATE_UPDATES:
        broadcast_to_role(role, 'gatepass_updated', {'id': gatepass.id, 'status': gatepass.status, 'resource': 'gatepass'})


def notify_room_allocated(room, user):
    """Notify when a room is allocated."""
    # Notify the user
    broadcast_to_updates_user(
        user.id,
        'room_allocated',
        {
            'room_id': room.id,
            'room_number': room.room_number,
            'resource': 'room',
        }
    )
    
    # Broadcast to room management staff
    for role in UserRoles.BROADCAST_ROOM_UPDATES:
        broadcast_to_role(role, 'room_allocated', {'room_id': room.id, 'room_number': room.room_number, 'user_id': user.id, 'resource': 'room'})


def notify_attendance_marked(attendance_record):
    """Notify when attendance is marked."""
    # Notify the student/user
    if getattr(attendance_record, 'user_id', None):
        broadcast_to_updates_user(
            attendance_record.user_id,
            'attendance_updated',
            {
                'date': str(attendance_record.attendance_date),
                'status': attendance_record.status,
                'resource': 'attendance',
            }
        )


def notify_meal_updated(meal):
    """Notify about meal updates."""
    # Broadcast to all students
    broadcast_to_role('student', 'meal_updated', {'meal_id': meal.id, 'meal_type': meal.meal_type, 'date': str(meal.date), 'resource': 'meal'})



def notify_notice_created(notice):
    """Notify about new notices."""
    # Send to targeted roles (default to all students)
    roles = notice.target_roles if hasattr(notice, 'target_roles') and notice.target_roles else ['student']
    
    for role in roles:
        broadcast_to_role(role, 'notice_created', {'notice_id': notice.id, 'title': notice.title, 'priority': getattr(notice, 'priority', 'normal'), 'resource': 'notice'})

# ── Performance Optimized Real-Time Sync Broadcasters ────────────────────────

def notify_unread_count_changed(user_id: int, delta: int):
    """
    Update local unread count badge in real-time without DB refetch.
    
    Args:
        user_id: Target user
        delta: Amount to change (+1 or -1). Delta 0 can trigger a full refetch if needed.
    """
    broadcast_to_updates_user(user_id, 'notification_unread_increment', {'delta': delta})

def notify_user_updated(user):
    """
    Notify management about user changes (activation, role).
    Also notifies the user themselves if their role changed to trigger instant role-switch.
    """
    # 1. Broad management update (for UsersPage sync - zero-refresh)
    data = {
        'id': user.id,
        'is_active': user.is_active,
        'role': user.role,
        'resource': 'user'
    }
    broadcast_to_management('user_updated', data)
    
    # 2. Direct self-update (for instant role switch / auth store update)
    broadcast_to_updates_user(user.id, 'self_role_changed', {
        'new_role': user.role,
        'is_active': user.is_active
    })

def notify_profile_updated(user_id: int):
    """Notify user that their profile (Digital ID) needs refresh."""
    broadcast_to_updates_user(user_id, 'profile_updated', {'id': user_id, 'resource': 'user'})

def notify_forecast_updated():
    """Broadcast forecast update to all management/concerned groups (Dashboard metrics)."""
    broadcast_to_management('forecast_updated', {'resource': 'forecast'})

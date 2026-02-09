"""
Utility functions for broadcasting WebSocket events to connected clients.

PRODUCTION-SAFE: All broadcast failures are logged and handled gracefully.
"""

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
from core.constants import UserRoles, ALL_STAFF_ROLES

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
    Send an in-app notification event to a specific user (notifications socket).
    
    Args:
        user_id: The user's ID
        data: Notification payload
    """
    broadcast_to_group(f'notifications_{user_id}', 'notification_received', data)


def broadcast_to_role(role: str, event_type: str, data: dict) -> bool:
    """
    Broadcast an event to all clients connected under a role group (updates socket).
    
    OPTIMIZATION: Staff roles are also part of a 'management' group to reduce Redis fan-out.
    Returns True if broadcast succeeded, False otherwise.
    """
    success = broadcast_to_group(f'role_{role}', event_type, data)
    
    # If the role is a staff role, also consider the management group for unified updates
    if role in ALL_STAFF_ROLES:
        broadcast_to_group('management', event_type, data)
    
    return success


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

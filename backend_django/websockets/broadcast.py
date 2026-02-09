"""
Utility functions for broadcasting WebSocket events to connected clients.
"""

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def broadcast_to_group(group_name: str, event_type: str, data: dict):
    """
    Broadcast an event to all clients in a specific group.
    
    Args:
        group_name: The channel group name (e.g., 'updates_123')
        event_type: Type of event (e.g., 'data_updated', 'notification_received')
        data: Event data to send
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(group_name, {'type': event_type, 'data': data})


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


def broadcast_to_role(role: str, event_type: str, data: dict):
    """
    Broadcast an event to all clients connected under a role group (updates socket).
    
    OPTIMIZATION: Staff roles are also part of a 'management' group to reduce Redis fan-out.
    """
    broadcast_to_group(f'role_{role}', event_type, data)
    
    # If the role is a staff role, also consider the management group for unified updates
    staff_roles = ['admin', 'super_admin', 'warden', 'head_warden', 'staff', 'gate_security', 'security_head', 'chef']
    if role in staff_roles:
        broadcast_to_group('management', event_type, data)


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
    
    # Broadcast to admins/wardens (role fan-out)
    for role in ['admin', 'super_admin', 'warden', 'head_warden', 'staff', 'gate_security', 'security_head']:
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
    
    # Broadcast to admins/wardens
    for role in ['admin', 'super_admin', 'warden', 'head_warden', 'staff']:
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

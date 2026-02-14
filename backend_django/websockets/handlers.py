"""WebSocket utilities."""

from channels.layers import get_channel_layer
import asyncio


def send_notification_async(user_id, data):
    """Send notification to user via WebSocket.
    
    Args:
        user_id: ID of the user to notify
        data: Dictionary of data to send
    """
    channel_layer = get_channel_layer()
    updates_group = f'updates_{user_id}'
    notifications_group = f'notifications_{user_id}'
    
    asyncio.create_task(
        channel_layer.group_send(
            updates_group,
            {
                'type': 'notification',
                'data': data
            }
        )
    )

    # Back-compat for clients using the dedicated notifications socket.
    asyncio.create_task(
        channel_layer.group_send(
            notifications_group,
            {
                'type': 'notification_received',
                'data': data,
            }
        )
    )


def broadcast_update(resource, resource_id, data):
    """Broadcast data update to subscribed users.
    
    Args:
        resource: Resource type (e.g., 'room', 'meal')
        resource_id: ID of the resource
        data: Update data
    """
    channel_layer = get_channel_layer()
    group_name = f'{resource}_{resource_id}_updates'
    
    asyncio.create_task(
        channel_layer.group_send(
            group_name,
            {
                'type': 'data_updated',
                'resource': resource,
                'data': data
            }
        )
    )

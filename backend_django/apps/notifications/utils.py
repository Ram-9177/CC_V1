"""Notification utilities."""

from .models import Notification
from apps.auth.models import User

def notify_user(recipient, title, message, notification_type='info', action_url=''):
    """Send a notification to a single user."""
    return Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url
    )

def notify_all_users(title, message, notification_type='info', action_url=''):
    """Send a notification to ALL active users."""
    users = User.objects.filter(is_active=True)
    # Using bulk_create would be faster but wouldn't trigger post_save signals for individual broadcasts.
    # Since we need the signal to trigger the WebSocket broadcast in signals.py, 
    # we create them individually or manually trigger broadcasts.
    # For now, we'll do individual creates for simplicity unless performance is an issue.
    for user in users:
        notify_user(user, title, message, notification_type, action_url)

def notify_role(role, title, message, notification_type='info', action_url=''):
    """Send a notification to all users with a specific role."""
    users = User.objects.filter(role=role, is_active=True)
    for user in users:
        notify_user(user, title, message, notification_type, action_url)

def notify_group(users_queryset, title, message, notification_type='info', action_url=''):
    """Send a notification to a queryset of users."""
    for user in users_queryset:
        notify_user(user, title, message, notification_type, action_url)

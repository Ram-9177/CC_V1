"""Notification utilities."""

from .models import Notification, WebPushSubscription
from apps.auth.models import User
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def send_web_push(user, title, message, url=''):
    try:
        from pywebpush import webpush, WebPushException
        subscriptions = WebPushSubscription.objects.filter(user=user)
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh_key,
                            "auth": sub.auth_key
                        }
                    },
                    data=json.dumps({
                        "title": title,
                        "body": message,
                        "url": url or '/'
                    }),
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_ADMIN_EMAIL}
                )
            except WebPushException as ex:
                logger.error(f"Web push failed: {repr(ex)}")
                if ex.response and ex.response.status_code in [404, 410]:
                    sub.delete()
    except Exception as e:
        logger.error(f"Failed to send web push to {user.username}: {e}")

def notify_user(recipient, title, message, notification_type='info', action_url=''):
    """Send a notification to a single user."""
    notif = Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url
    )
    send_web_push(recipient, title, message, action_url)
    return notif

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

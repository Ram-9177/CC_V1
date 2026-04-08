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

def notify_user(recipient, title, message, notification_type='info', action_url='', college=None):
    """Send a notification to a single user."""
    create_kwargs = dict(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url,
    )
    if college is not None:
        create_kwargs['college'] = college
    elif recipient is not None:
        # Auto-assign college from recipient if not explicitly provided
        recipient_college = getattr(recipient, 'college', None)
        if recipient_college is not None:
            create_kwargs['college'] = recipient_college
    notif = Notification.objects.create(**create_kwargs)
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

def notify_role(role, title, message, notification_type='info', action_url='', college_id=None):
    """Send a notification to all users with a specific role."""
    users = User.objects.filter(role=role, is_active=True)
    if college_id is not None:
        users = users.filter(college_id=college_id)
    for user in users:
        notify_user(user, title, message, notification_type, action_url)

def notify_group(users_queryset, title, message, notification_type='info', action_url=''):
    """Send a notification to a queryset of users."""
    for user in users_queryset:
        notify_user(user, title, message, notification_type, action_url)

def notify_targeted_students(target_audience, title, message, notification_type='info', action_url='', college_id=None):
    """
    Send notifications only to the relevant subset of students.
    Handles values: 'hostellers', 'day_scholars', 'all_students', 'all'.
    
    OPTIMIZATION: Creates a single 'Global' notification record with target_audience
    instead of thousands of individual records.
    """
    from core.constants import AudienceTargets
    
    # 1. Create a Global Notification record for historical tracking and inbox display
    Notification.objects.create(
        recipient=None, # Global
        target_audience=target_audience,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url,
        college_id=college_id,
    )
    
    # 2. Trigger individual Web Push notifications (Push still needs to be individual)
    users = User.objects.filter(is_active=True, role='student')
    if college_id is not None:
        users = users.filter(college_id=college_id)
    if target_audience == AudienceTargets.HOSTELLERS:
        users = users.filter(student_type='hosteller')
    elif target_audience == AudienceTargets.DAY_SCHOLARS:
        users = users.filter(student_type='day_scholar')
        
    for user in users:
        send_web_push(user, title, message, action_url)

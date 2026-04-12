"""Async Celery tasks for notification delivery.

All heavy notification fan-outs (notify_role, notify_group, notify_targeted_students)
are offloaded here so request/response cycles stay fast.

Usage (from NotificationService — do NOT call these directly):
    from apps.notifications.tasks import send_notification_task
    send_notification_task.delay(user_id, title, message, notif_type, action_url)
"""

import logging
from django.utils import timezone

from core.celery_tasks import resilient_shared_task

logger = logging.getLogger(__name__)


@resilient_shared_task(
    name='apps.notifications.tasks.send_notification_task',
    max_retries=3,
    default_retry_delay=5,
)
def send_notification_task(self, user_id: int, title: str, message: str,
                            notif_type: str = 'info', action_url: str = '',
                            college_id=None):
    """Send a notification to a single user (async)."""
    try:
        from apps.auth.models import User
        from apps.notifications.utils import notify_user
        user = User.objects.get(pk=user_id)
        college = None
        if college_id:
            from apps.colleges.models import College
            college = College.objects.filter(pk=college_id).first()
        notify_user(user, title, message, notif_type, action_url, college=college)
    except Exception as exc:
        self.retry_with_context(exc, context=f'send_notification_task user_id={user_id}')


@resilient_shared_task(
    name='apps.notifications.tasks.send_role_notification_task',
    max_retries=2,
    default_retry_delay=10,
)
def send_role_notification_task(self, role: str, title: str, message: str,
                                 notif_type: str = 'info', action_url: str = '',
                                 college_id=None):
    """Fan-out notification to all users with a given role (async)."""
    try:
        from apps.notifications.utils import notify_role
        notify_role(role, title, message, notif_type, action_url, college_id=college_id)
    except Exception as exc:
        self.retry_with_context(exc, context=f'send_role_notification_task role={role}')


@resilient_shared_task(
    name='apps.notifications.tasks.send_audience_notification_task',
    max_retries=2,
    default_retry_delay=10,
)
def send_audience_notification_task(self, target_audience: str, title: str, message: str,
                                     notif_type: str = 'info', action_url: str = '',
                                     college_id=None):
    """Fan-out notification to a student audience segment (async)."""
    try:
        from apps.notifications.utils import notify_targeted_students
        notify_targeted_students(target_audience, title, message, notif_type, action_url, college_id=college_id)
    except Exception as exc:
        self.retry_with_context(exc, context=f'send_audience_notification_task audience={target_audience}')


@resilient_shared_task(
    name='apps.notifications.tasks.send_group_notification_task',
    max_retries=2,
    default_retry_delay=10,
)
def send_group_notification_task(self, user_ids: list, title: str, message: str,
                                  notif_type: str = 'info', action_url: str = ''):
    """Fan-out notification to an explicit list of user IDs (async)."""
    try:
        from apps.auth.models import User
        from apps.notifications.utils import notify_group
        users = User.objects.filter(pk__in=user_ids, is_active=True)
        notify_group(users, title, message, notif_type, action_url)
    except Exception as exc:
        self.retry_with_context(exc, context='send_group_notification_task')


@resilient_shared_task(
    name='apps.notifications.tasks.cleanup_old_notifications',
    max_retries=1,
)
def cleanup_old_notifications(self):
    """Delete read notifications older than 30 days (runs daily via beat)."""
    try:
        from apps.notifications.models import Notification

        cutoff = timezone.now() - timezone.timedelta(days=30)
        deleted, _ = Notification.objects.filter(is_read=True, created_at__lt=cutoff).delete()
        logger.info(f"cleanup_old_notifications: deleted {deleted} old notifications")
    except Exception as exc:
        self.retry_with_context(exc, context='cleanup_old_notifications', countdown=10, max_retries=1)

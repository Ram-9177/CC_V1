"""Centralized notification service.

All modules MUST call this service instead of importing utils directly.
This is the single source of truth for sending notifications.

Delivery strategy:
  - If Celery broker is reachable → tasks are dispatched async via .delay()
  - If broker is unavailable (dev / no Redis) → falls back to synchronous delivery

Usage:
    from apps.notifications.service import NotificationService

    NotificationService.send(user=student, title="Pass Approved", message="...", notif_type='success')
    NotificationService.send_to_role('warden', title="Late Return", message="...", notif_type='warning')
    NotificationService.send_to_audience('hostellers', title="Meal Update", message="...")
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helper — dispatch async or fall back to sync
# ---------------------------------------------------------------------------

def _dispatch(task_fn, sync_fn, *args, **kwargs):
    """Try to dispatch task_fn.delay(*args); fall back to sync_fn(*args) on error."""
    try:
        task_fn.delay(*args, **kwargs)
    except Exception as broker_err:
        logger.warning(
            f"Celery broker unavailable ({broker_err}), falling back to sync notification."
        )
        try:
            sync_fn(*args, **kwargs)
        except Exception as sync_err:
            logger.error(f"Sync notification fallback also failed: {sync_err}")


class NotificationService:
    """Single entry point for all notification delivery."""

    @staticmethod
    def send(
        user,
        title: str,
        message: str,
        notif_type: str = 'info',
        action_url: str = '',
        college=None,
    ):
        """Send a notification to a single user (async via Celery)."""
        try:
            from apps.notifications.tasks import send_notification_task
            from apps.notifications.utils import notify_user

            college_id = getattr(college, 'id', None) if college else None
            user_id = getattr(user, 'id', None)
            if user_id is None:
                return
            _dispatch(
                send_notification_task,
                lambda *a, **kw: notify_user(user, title, message, notif_type, action_url, college=college),
                user_id, title, message, notif_type, action_url, college_id,
            )
        except Exception as e:
            logger.error(f"NotificationService.send failed for user {getattr(user, 'id', '?')}: {e}")

    @staticmethod
    def send_to_role(
        role: str,
        title: str,
        message: str,
        notif_type: str = 'info',
        action_url: str = '',
        college_id=None,
    ):
        """Send a notification to all active users with a given role (async)."""
        try:
            from apps.notifications.tasks import send_role_notification_task
            from apps.notifications.utils import notify_role

            _dispatch(
                send_role_notification_task,
                lambda *a, **kw: notify_role(role, title, message, notif_type, action_url),
                role, title, message, notif_type, action_url, college_id,
            )
        except Exception as e:
            logger.error(f"NotificationService.send_to_role failed for role {role}: {e}")

    @staticmethod
    def send_to_roles(
        roles: list,
        title: str,
        message: str,
        notif_type: str = 'info',
        action_url: str = '',
    ):
        """Send a notification to all active users in any of the given roles."""
        for role in roles:
            NotificationService.send_to_role(role, title, message, notif_type, action_url)

    @staticmethod
    def send_to_audience(
        target_audience: str,
        title: str,
        message: str,
        notif_type: str = 'info',
        action_url: str = '',
    ):
        """Send a notification to a student audience segment (async)."""
        try:
            from apps.notifications.tasks import send_audience_notification_task
            from apps.notifications.utils import notify_targeted_students

            _dispatch(
                send_audience_notification_task,
                lambda *a, **kw: notify_targeted_students(target_audience, title, message, notif_type, action_url),
                target_audience, title, message, notif_type, action_url,
            )
        except Exception as e:
            logger.error(f"NotificationService.send_to_audience failed for audience {target_audience}: {e}")

    @staticmethod
    def send_to_group(users_queryset, title: str, message: str,
                      notif_type: str = 'info', action_url: str = ''):
        """Send a notification to an arbitrary queryset of users (async)."""
        try:
            from apps.notifications.tasks import send_group_notification_task
            from apps.notifications.utils import notify_group

            user_ids = list(users_queryset.values_list('id', flat=True))
            if not user_ids:
                return
            _dispatch(
                send_group_notification_task,
                lambda *a, **kw: notify_group(users_queryset, title, message, notif_type, action_url),
                user_ids, title, message, notif_type, action_url,
            )
        except Exception as e:
            logger.error(f"NotificationService.send_to_group failed: {e}")

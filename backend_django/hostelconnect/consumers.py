"""Project-level websocket consumers."""

from apps.notifications.consumers import NotificationConsumer as AppNotificationConsumer


class NotificationConsumer(AppNotificationConsumer):
    """Project-level notification consumer alias for websocket routing."""


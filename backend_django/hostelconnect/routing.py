"""Project-level websocket routing."""

from django.urls import path

from hostelconnect.consumers import NotificationConsumer
from websockets.routing import websocket_urlpatterns as legacy_websocket_urlpatterns


def _without_legacy_notification_route(urlpatterns):
    return [
        pattern
        for pattern in urlpatterns
        if getattr(pattern.pattern, "_route", "") != "ws/notifications/"
    ]


websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
websocket_urlpatterns.extend(_without_legacy_notification_route(legacy_websocket_urlpatterns))


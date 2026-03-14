"""WebSocket URL routing for Django Channels."""

from django.urls import path

from apps.gate_passes.consumers import GatePassConsumer
from apps.metrics.consumers import DashboardConsumer
from apps.notifications.consumers import NotificationConsumer
from websockets.consumers import CampusCoreConsumer


websocket_urlpatterns = [
    path('ws/', CampusCoreConsumer.as_asgi()),
    path('ws/gatepass/', GatePassConsumer.as_asgi()),
    path('ws/dashboard/', DashboardConsumer.as_asgi()),
    path('ws/notifications/', NotificationConsumer.as_asgi()),
]

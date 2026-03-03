"""WebSocket URL routing for Django Channels."""

from django.urls import re_path
from websockets import consumers

websocket_urlpatterns = [
    re_path(r'ws/main/$', consumers.HostelConnectConsumer.as_asgi()),
    re_path(r'ws/notifications/$', consumers.HostelConnectConsumer.as_asgi()),
    re_path(r'ws/updates/$', consumers.HostelConnectConsumer.as_asgi()),
    re_path(r'ws/presence/$', consumers.HostelConnectConsumer.as_asgi()),
]

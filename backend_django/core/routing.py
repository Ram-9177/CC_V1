from django.urls import path

from core.consumers import BasicWebSocketConsumer

websocket_urlpatterns = [
    path('ws/core/', BasicWebSocketConsumer.as_asgi()),
]

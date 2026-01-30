"""
ASGI config for hostelconnect project with Django Channels support.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')

django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from websockets import routing
from websockets.middleware import JWTAuthMiddlewareStack

# Get the Django ASGI application
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    # Django's ASGI application to handle traditional HTTP requests
    'http': django_asgi_app,
    
    # WebSocket handler with JWT authentication from query string
    'websocket': JWTAuthMiddlewareStack(
        URLRouter(
            routing.websocket_urlpatterns
        )
    ),
})

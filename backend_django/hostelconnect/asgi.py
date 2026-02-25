"""
ASGI config for hostelconnect project with Django Channels support.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator
from django.conf import settings
from websockets import routing
from websockets.middleware import JWTAuthMiddlewareStack

# Get the Django ASGI application
django_asgi_app = get_asgi_application()

# Combine ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS for robust WebSocket security
allowed_origins = []
if hasattr(settings, 'CORS_ALLOWED_ORIGINS'):
    allowed_origins = list(settings.CORS_ALLOWED_ORIGINS)

# Add local development defaults
allowed_origins += ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]

application = ProtocolTypeRouter({
    # Django's ASGI application to handle traditional HTTP requests
    'http': django_asgi_app,
    
    # WebSocket handler with origin validation and JWT auth
    'websocket': AllowedHostsOriginValidator(
        OriginValidator(
            JWTAuthMiddlewareStack(
                URLRouter(
                    routing.websocket_urlpatterns
                )
            ),
            allowed_origins
        )
    ),
})

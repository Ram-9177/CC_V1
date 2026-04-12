"""
ASGI config for hostelconnect project with Django Channels support.

Uses JWTAuthMiddlewareStack so existing authenticated WebSocket routes keep working.
A plain AuthMiddlewareStack would not populate JWT users from the same pipeline.
"""

import os
import django
from urllib.parse import urlparse

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

# Warm up database and cache connections to minimize first-request latency
from django.db import connection
from django.core.cache import cache
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    cache.set('startup_warmup', 'ok', timeout=5)
except Exception:
    pass

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator
from django.conf import settings
from hostelconnect.routing import websocket_urlpatterns
from websockets.middleware import JWTAuthMiddlewareStack

# Get the Django ASGI application
django_asgi_app = get_asgi_application()

def _normalize_origin(origin: str):
    origin = (origin or '').strip().rstrip('/')
    if not origin:
        return None
    parsed = urlparse(origin)
    if parsed.scheme in {'http', 'https'} and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return None


# Build websocket-allowed origins from all trusted origin sources.
allowed_origins_set = set()

for origin in getattr(settings, 'CORS_ALLOWED_ORIGINS', []):
    normalized = _normalize_origin(origin)
    if normalized:
        allowed_origins_set.add(normalized)

for origin in getattr(settings, 'CSRF_TRUSTED_ORIGINS', []):
    normalized = _normalize_origin(origin)
    if normalized:
        allowed_origins_set.add(normalized)

for host in getattr(settings, 'ALLOWED_HOSTS', []):
    host = (host or '').strip()
    if not host or host == '*':
        continue
    # Skip broad platform wildcards; include concrete hosts and first-party wildcard roots.
    if host in {'.onrender.com', '.ondigitalocean.app'}:
        continue
    if host.startswith('.'):
        root_host = host[1:]
        if root_host:
            allowed_origins_set.add(f'https://{root_host}')
            allowed_origins_set.add(f'https://*.{root_host}')
        continue
    if not host:
        continue
    if host in {'localhost', '127.0.0.1', '0.0.0.0'}:
        allowed_origins_set.add(f'http://{host}')
        allowed_origins_set.add(f'https://{host}')
    elif host[0].isdigit():
        allowed_origins_set.add(f'http://{host}')
        allowed_origins_set.add(f'https://{host}')
    else:
        allowed_origins_set.add(f'https://{host}')

# Local development defaults
allowed_origins_set.update({
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
})

allowed_origins = sorted(allowed_origins_set)

application = ProtocolTypeRouter({
    # Django's ASGI application to handle traditional HTTP requests
    'http': django_asgi_app,
    
    # WebSocket handler with origin validation and JWT auth
    'websocket': AllowedHostsOriginValidator(
        OriginValidator(
            JWTAuthMiddlewareStack(
                URLRouter(
                    websocket_urlpatterns
                )
            ),
            allowed_origins
        )
    ),
})

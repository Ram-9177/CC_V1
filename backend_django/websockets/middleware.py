"""Custom JWT auth middleware for Django Channels.

Allows WebSocket authentication using JWT tokens provided via query string,
e.g., ws://host/ws/notifications/?token=<JWT>.
"""

from typing import Optional
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections

from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.backends import TokenBackend
from django.conf import settings


User = get_user_model()


@database_sync_to_async
def get_user_by_id(user_id: int) -> Optional[User]:
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


class JWTAuthMiddleware(BaseMiddleware):
    """Channels middleware that authenticates a user via JWT in the query string."""

    def __init__(self, inner):
        super().__init__(inner)
        self._token_backend = TokenBackend(
            algorithm=getattr(settings, 'SIMPLE_JWT', {}).get('ALGORITHM', 'HS256'),
            signing_key=settings.SECRET_KEY,
            verifying_key=None,
        )

    async def __call__(self, scope, receive, send):
        # Ensure DB connections are closed before processing
        close_old_connections()

        # Default to anonymous
        scope['user'] = AnonymousUser()

        try:
            # Parse token from query string (primary) or headers (fallback for security)
            query_string = scope.get('query_string', b'').decode('utf-8')
            qs = parse_qs(query_string)
            token_list = qs.get('token') or qs.get('access_token')
            token = token_list[0] if token_list else None

            # If no token in query string, try headers (for future-proofing, though WebSocket API doesn't support custom headers during handshake)
            if not token and 'headers' in scope:
                for header_name, header_value in scope['headers']:
                    if header_name.lower() == b'authorization':
                        # Expected format: "Bearer <token>"
                        auth_header = header_value.decode('utf-8')
                        if auth_header.startswith('Bearer '):
                            token = auth_header[7:]
                        break

            if token:
                # Validate token and extract payload
                payload = self._token_backend.decode(token, verify=True)
                user_id = payload.get('user_id') or payload.get('id')

                if user_id:
                    user = await get_user_by_id(int(user_id))
                    if user is not None:
                        scope['user'] = user
        except Exception:
            # On any failure, keep AnonymousUser
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Convenience wrapper to build a middleware stack for JWT auth."""
    return JWTAuthMiddleware(inner)

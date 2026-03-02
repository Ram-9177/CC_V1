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


import logging
logger = logging.getLogger(__name__)

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
        # Default to anonymous
        scope['user'] = AnonymousUser()

        try:
            # 1. Look for token in query string (traditional frontend implementation)
            query_string = scope.get('query_string', b'').decode('utf-8')
            qs = parse_qs(query_string)
            token_list = qs.get('token') or qs.get('access_token')
            token = token_list[0] if token_list else None

            # 2. Institutional Fallback: Robustly parse tokens from HttpOnly cookies (Secure Boundary)
            if not token:
                headers = dict(scope.get('headers', []))
                cookie_header = headers.get(b'cookie', b'').decode('utf-8')
                
                if cookie_header:
                    import http.cookies
                    cookie_obj = http.cookies.SimpleCookie()
                    cookie_obj.load(cookie_header)
                    
                    auth_cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
                    if auth_cookie_name in cookie_obj:
                        token = cookie_obj[auth_cookie_name].value

            if token:
                try:
                    # Validate token and extract payload
                    payload = self._token_backend.decode(token, verify=True)
                    user_id = payload.get('user_id') or payload.get('id')

                    if user_id:
                        user = await get_user_by_id(int(user_id))
                        if user is not None:
                            scope['user'] = user
                        else:
                            if settings.DEBUG:
                                logger.warning(f"[WS Auth] User ID {user_id} not found in database")
                    else:
                        if settings.DEBUG:
                             logger.warning("[WS Auth] Token payload missing user_id")
                except Exception as e:
                    if settings.DEBUG:
                        logger.warning(f"[WS Auth] Token validation failed: {str(e)}")
            elif settings.DEBUG and query_string:
                logger.debug("[WS Auth] No token found in query string or cookies")

        except Exception as e:
            if settings.DEBUG:
                logger.error(f"[WS Auth] Unexpected error: {str(e)}")
        
        # Ensure DB connections are closed before processing next middleware
        close_old_connections()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Convenience wrapper to build a middleware stack for JWT auth."""
    return JWTAuthMiddleware(inner)

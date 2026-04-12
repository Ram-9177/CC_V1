"""
Core architecture decorators for institutional-grade reliability.
Includes Idempotency, RBAC, and Performance tracing.
"""
from functools import wraps
from rest_framework.response import Response
from core.models import IdempotencyKey
from django.db import transaction
import logging

logger = logging.getLogger(__name__)

def idempotent_route(ttl: int = 86400):
    """
    God-Level Idempotency Guard.
    Automatically intercepts 'Idempotency-Key' from headers and replays
    cached responses to prevent duplicate side-effects.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(instance, request, *args, **kwargs):
            key = request.headers.get("Idempotency-Key")
            if not key:
                # Proceed normally if no key provided
                return view_func(instance, request, *args, **kwargs)

            user_id = request.user.id if request.user.is_authenticated else "anon"
            
            # 1. Check for existing response
            cached_response, is_new = IdempotencyKey.objects.get_or_create_response(key, user_id, ttl)
            if not is_new:
                logger.info(f"[Idempotency] Replaying cached response for key: {key}")
                return Response(cached_response, status=200)

            # 2. Execute view (Atomic)
            try:
                with transaction.atomic():
                    response = view_func(instance, request, *args, **kwargs)
                
                # 3. Cache successful response if it's 2xx
                if 200 <= response.status_code < 300:
                    try:
                        IdempotencyKey.objects.mark_done(key, user_id, response.data, ttl)
                    except Exception as cache_exc:
                        # Cache failures must never fail the request path.
                        logger.warning(
                            "[Idempotency] Cache write failed for key %s: %s",
                            key,
                            cache_exc,
                        )
                
                return response
            except Exception as e:
                # Do NOT cache errors — allow retry
                logger.error(f"[Idempotency] View execution failed, not caching key: {key}. Error: {e}")
                raise e

        return _wrapped_view
    return decorator

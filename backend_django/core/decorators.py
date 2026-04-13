"""
Core architecture decorators for institutional-grade reliability.
Includes Idempotency, RBAC, and Performance tracing.
"""
from functools import wraps
import logging

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from core.models import IdempotencyKey
from core.utils.idempotency_payload import hash_request_body

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
            body_hash = hash_request_body(request)
            scoped_key = f"{user_id}:{key}"

            # 1. Check for existing response
            cached_response, is_new = IdempotencyKey.objects.get_or_create_response(key, user_id, ttl)
            if not is_new:
                try:
                    rec = IdempotencyKey.objects.get(key=scoped_key)
                    if (
                        rec.request_body_sha256
                        and body_hash != rec.request_body_sha256
                    ):
                        return Response(
                            {
                                "success": False,
                                "code": "IDEMPOTENCY_KEY_CONFLICT",
                                "message": (
                                    "This Idempotency-Key was already used with a "
                                    "different request body."
                                ),
                                "details": {},
                            },
                            status=status.HTTP_409_CONFLICT,
                        )
                except IdempotencyKey.DoesNotExist:
                    pass
                logger.info(f"[Idempotency] Replaying cached response for key: {key}")
                return Response(cached_response, status=200)

            # 2. Execute view (Atomic)
            try:
                with transaction.atomic():
                    response = view_func(instance, request, *args, **kwargs)
                
                # 3. Cache successful response if it's 2xx
                if 200 <= response.status_code < 300:
                    try:
                        IdempotencyKey.objects.mark_done(
                            key,
                            user_id,
                            response.data,
                            ttl,
                            request_body_sha256=body_hash,
                        )
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

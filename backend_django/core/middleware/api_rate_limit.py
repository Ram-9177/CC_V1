"""
Optional Redis-backed API rate limiting (per user or IP).

Disabled by default (``API_GATEWAY_RATE_LIMIT_ENABLED=False``) for zero behavior change.
When enabled, returns HTTP 429 without touching view logic.
"""

from __future__ import annotations

import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def _client_key(request) -> str:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return f"u:{user.pk}"
    xff = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    ip = xff or request.META.get("REMOTE_ADDR") or "unknown"
    return f"ip:{ip}"


def _classify(request) -> tuple[str, int]:
    path = (request.path or "").lower()
    method = (request.method or "GET").upper()
    auth_hints = (
        "/auth/",
        "/token",
        "/login",
        "/jwt",
        "/password",
        "/register",
    )
    if any(h in path for h in auth_hints):
        return "auth", int(getattr(settings, "API_RL_AUTH_PER_MINUTE", 5))
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        return "write", int(getattr(settings, "API_RL_WRITE_PER_MINUTE", 30))
    return "read", int(getattr(settings, "API_RL_READ_PER_MINUTE", 100))


def _incr_window(cache_key: str, limit: int, window_seconds: int = 60) -> int:
    try:
        try:
            n = cache.incr(cache_key)
        except ValueError:
            cache.add(cache_key, 1, timeout=window_seconds)
            n = 1
    except Exception:
        logger.warning("Rate limit cache failure for %s; allowing request", cache_key, exc_info=True)
        return 0
    return n


class ApiGatewayRateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, "API_GATEWAY_RATE_LIMIT_ENABLED", False):
            return self.get_response(request)

        path = request.path or ""
        if not path.startswith("/api/"):
            return self.get_response(request)
        if path.startswith("/api/schema") or path.startswith("/api/docs"):
            return self.get_response(request)

        bucket, limit = _classify(request)
        window = int(time.time() // 60)
        ident = _client_key(request)
        key = f"gw_rl:{bucket}:{ident}:{window}"

        n = _incr_window(key, limit)
        if n > limit:
            payload = {
                "success": False,
                "code": "RATE_LIMITED",
                "message": "Too many requests. Please slow down and try again shortly.",
                "details": {"bucket": bucket, "limit_per_minute": limit},
            }
            return JsonResponse(payload, status=429)

        response = self.get_response(request)
        try:
            response["X-RateLimit-Limit"] = str(limit)
            response["X-RateLimit-Remaining"] = str(max(0, limit - n))
        except Exception:
            pass
        return response

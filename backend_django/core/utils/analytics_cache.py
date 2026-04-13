"""
Short-lived cache helpers for read-heavy analytics / dashboards.

Never use for mutating endpoints.
"""

from __future__ import annotations

import hashlib
import json
from functools import wraps
from typing import Any, Callable

from django.core.cache import cache
from django.http import HttpRequest


def _tenant_part(request: HttpRequest) -> str:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        cid = getattr(user, "college_id", None)
        return str(cid) if cid is not None else f"u:{user.pk}"
    return "anon"


def analytics_cache_key(view_name: str, request: HttpRequest, extra: dict[str, Any] | None = None) -> str:
    """Stable key: tenant + view + sorted query params."""
    q = sorted((request.GET or {}).items())
    raw = json.dumps({"q": q, "x": extra or {}}, sort_keys=True, default=str)
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"analytics:{view_name}:t{_tenant_part(request)}:{h}"


def cached_analytics(
    view_name: str,
    ttl_seconds: int = 60,
    *,
    extra_fn: Callable[[HttpRequest], dict[str, Any]] | None = None,
):
    """
    Decorator for DRF API views: cache JSON response body for GET only.

    Example::

        @cached_analytics("warden_dashboard", ttl_seconds=30)
        def get(self, request):
            return Response(...)
    """

    def decorator(view_method):
        @wraps(view_method)
        def _wrapped(self, request, *args, **kwargs):
            if request.method.upper() != "GET":
                return view_method(self, request, *args, **kwargs)
            ex = extra_fn(request) if extra_fn else {}
            key = analytics_cache_key(view_name, request, ex)
            hit = cache.get(key)
            if hit is not None:
                from rest_framework.response import Response

                return Response(hit)
            response = view_method(self, request, *args, **kwargs)
            try:
                if getattr(response, "status_code", 500) == 200 and hasattr(
                    response, "data"
                ):
                    cache.set(key, response.data, timeout=ttl_seconds)
            except Exception:
                pass
            return response

        return _wrapped

    return decorator

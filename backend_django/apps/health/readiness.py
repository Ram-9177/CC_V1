"""
Kubernetes-style readiness: DB + cache must be usable.

Additive endpoints only; does not replace existing ``/health/`` liveness.
"""

from __future__ import annotations

import time

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def readiness_check(request):
    """
    Return 200 if the instance can serve traffic (DB + Redis cache).

    Use for load balancer / orchestrator readiness probes.
    """
    errors = []
    t0 = time.time()
    db_ok = False
    cache_ok = False

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_ok = True
    except Exception as exc:
        errors.append(f"database:{exc}")

    try:
        from core.cache_keys import health_check as _hc_key

        k = _hc_key()
        cache.set(k, "ready", 2)
        cache_ok = cache.get(k) == "ready"
        if not cache_ok:
            errors.append("cache:unexpected_value")
    except Exception as exc:
        errors.append(f"cache:{exc}")

    elapsed_ms = int((time.time() - t0) * 1000)
    ok = db_ok and cache_ok
    body = {
        "ready": ok,
        "database": "ok" if db_ok else "fail",
        "cache": "ok" if cache_ok else "fail",
        "latency_ms": elapsed_ms,
    }
    if errors:
        body["errors"] = errors
    return JsonResponse(body, status=200 if ok else 503)

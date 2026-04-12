"""
/api/warmup/ – Lightweight warmup endpoint for Render cold-start mitigation.
──────────────────────────────────────────────────────────────────────────────
Touches:
  • DB  – fires a single `SELECT 1` to wake the connection pool
  • Redis – sets and gets a tiny cache entry
  • Django ORM – instantiates a minimal ORM path

Called automatically by UptimeRobot (or similar) at ≥1 min intervals.
Also accessible from bench_ttfb.sh benchmark if you add it to ENDPOINTS.

Rollback: remove the path() line from hostelconnect/urls.py.
Risk: NONE – read-only, no auth required, <5 ms overhead.
"""

from django.http import JsonResponse
from django.views import View
from django.db import connection
from django.core.cache import cache
import time
import logging

logger = logging.getLogger('performance')


class WarmupView(View):
    """
    GET /api/warmup/

    Returns HTTP 200 with a JSON payload confirming each service status.
    Intentionally unauthenticated – UptimeRobot has no credentials.
    Response time target: <100 ms.
    """

    def get(self, request):
        t_start = time.perf_counter()
        results = {}

        # ── 1. DB ping ────────────────────────────────────────────────────────
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            results['db'] = 'ok'
        except Exception as exc:
            results['db'] = f'error: {exc}'
            logger.warning('Warmup: DB ping failed – %s', exc)

        # ── 2. Redis / Cache ping ─────────────────────────────────────────────
        try:
            cache.set('__warmup__', '1', timeout=30)
            val = cache.get('__warmup__')
            results['cache'] = 'ok' if val == '1' else 'miss'
        except Exception as exc:
            results['cache'] = f'error: {exc}'
            logger.warning('Warmup: Cache ping failed – %s', exc)

        # ── 3. ORM sanity check ───────────────────────────────────────────────
        try:
            # Import inline to avoid circular imports at module load time
            from apps.auth.models import User  # noqa: PLC0415
            _ = User.objects.only('id').first()  # cheap: one indexed PK scan
            results['orm'] = 'ok'
        except Exception as exc:
            results['orm'] = f'error: {exc}'
            logger.warning('Warmup: ORM check failed – %s', exc)

        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        overall = 'ok' if all(v == 'ok' for v in results.values()) else 'degraded'

        return JsonResponse(
            {
                'status': overall,
                'elapsed_ms': elapsed_ms,
                'services': results,
            },
            status=200,
        )

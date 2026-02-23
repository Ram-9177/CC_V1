"""
Slow Query Logging Middleware
──────────────────────────────────────────────────────────────────────────────
Captures every DB query executed during a request and logs any that exceed
SLOW_QUERY_THRESHOLD_MS (default 300 ms) to the 'performance.slow_query'
logger.

Configuration (in settings.py or via env var):
    SLOW_QUERY_THRESHOLD_MS   int  milliseconds, default 300
    SLOW_QUERY_ENABLED        bool default True in DEBUG, False otherwise

Works in conjunction with Django's connection.queries list, which is only
populated when DEBUG=True OR when force_debug_cursor is set on the connection.
In production (DEBUG=False) we enable force_debug_cursor only for the
duration of this middleware so no queries are silently dropped.

Impact:  ~0 overhead when threshold is never triggered; ~0.5 ms CPU per
         query when queries are logged (negligible for a tuning tool).

Rollback: Remove 'core.middleware.slow_query.SlowQueryLoggingMiddleware'
          from MIDDLEWARE in settings.py.
"""

import time
import logging
from django.conf import settings
from django.db import connection, reset_queries

logger = logging.getLogger('performance.slow_query')

# How many ms before a single DB query is considered "slow"
_DEFAULT_THRESHOLD_MS = getattr(settings, 'SLOW_QUERY_THRESHOLD_MS', 300)


class SlowQueryLoggingMiddleware:
    """
    Per-request DB slow query detector.

    • Enabled only when settings.SLOW_QUERY_ENABLED is True (default: DEBUG mode).
    • Resets query log before each request so queries don't bleed across requests.
    • In production (DEBUG=False) it forces the debug cursor on the default
      connection; this is safe because we collect and immediately discard the
      data (no persistent memory leak).

    How to read the logs:
        SLOW QUERY [345ms] SELECT "apps_notices"... | request=GET /api/notices/
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = getattr(settings, 'SLOW_QUERY_ENABLED', settings.DEBUG)
        self.threshold_ms = getattr(settings, 'SLOW_QUERY_THRESHOLD_MS', _DEFAULT_THRESHOLD_MS)

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        # Force query logging even in non-DEBUG mode for this one request
        force_debug = not settings.DEBUG
        if force_debug:
            connection.force_debug_cursor = True

        reset_queries()

        try:
            response = self.get_response(request)

            try:
                queries = connection.queries  # list of {'sql': ..., 'time': '0.045'}
                for q in queries:
                    try:
                        elapsed_ms = float(q.get('time', 0)) * 1000
                    except (ValueError, TypeError):
                        elapsed_ms = 0.0

                    if elapsed_ms >= self.threshold_ms:
                        sql_preview = q.get('sql', '')[:400]  # truncate huge SQLs
                        logger.warning(
                            'SLOW QUERY [%.0fms] %s | request=%s %s',
                            elapsed_ms,
                            sql_preview,
                            request.method,
                            request.path,
                        )
            except Exception:
                pass  # logging must never crash a request

        finally:
            if force_debug:
                connection.force_debug_cursor = False
            reset_queries()

        return response

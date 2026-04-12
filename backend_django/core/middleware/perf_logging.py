"""
core/middleware/perf_logging.py
─────────────────────────────────────────────────────────────────────────────
Logs per-request performance metrics.

Improvements vs original:
  • Uses X-Request-Duration response header so Render/nginx log parsers can
    extract latency without grep'ing logs.
  • Skips logging for health-check endpoints that are pinged every 30s
    (prevents log spam on Render's free tier monitoring).
  • Tracks status code for error-rate monitoring.
  • Adds threshold check (don't log fast boring requests in production).
"""

import time
import logging

logger = logging.getLogger('performance')

# Paths that are polled frequently; exclude from per-request timing logs
_SKIP_PATHS = frozenset(['/api/health/', '/health/', '/favicon.ico', '/static/'])

# Only log slow requests in production (DEBUG=False)
_PROD_THRESHOLD_MS = 100  # Only log if > 100ms in production


class PerformanceLoggingMiddleware:
    """
    Log basic performance metrics for each request.
    Attaches X-Request-Duration header for upstream log parsers.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        from django.conf import settings
        self.debug = settings.DEBUG

    def __call__(self, request):
        # Skip noisy health-check paths
        if request.path in _SKIP_PATHS or request.path.startswith('/static/'):
            return self.get_response(request)

        start = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        # Always attach the header (helps NGINX/Render access logs)
        try:
            response['X-Request-Duration'] = f'{elapsed_ms}ms'
        except Exception:
            pass

        try:
            # Thresholds for logging
            # WARN if > 2s (serious latency)
            # INFO if > 100ms (standard tracking)
            if elapsed_ms >= 2000:
                user_disp = getattr(request, 'user', 'Anonymous')
                user_id = getattr(user_disp, 'id', 'N/A')
                logger.warning(
                    'Slow Request: %s %s %d %dms | User: %s (ID: %s)',
                    request.method,
                    request.path,
                    response.status_code,
                    elapsed_ms,
                    user_disp,
                    user_id
                )
            elif self.debug or elapsed_ms >= _PROD_THRESHOLD_MS:
                logger.info(
                    '%s %s %d %dms',
                    request.method,
                    request.path,
                    response.status_code,
                    elapsed_ms,
                )
        except Exception:
            pass  # never raise from middleware

        return response

import time
import logging

logger = logging.getLogger('performance')


class PerformanceLoggingMiddleware:
    """Log basic performance metrics for each request.

    Logs: HTTP method, path, and response time in ms to the 'performance' logger.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        try:
            logger.info('%s %s %sms', request.method, request.path, elapsed_ms)
        except Exception:
            # never raise from middleware
            pass
        return response

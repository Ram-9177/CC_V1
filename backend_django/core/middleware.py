import time
import logging
import threading

logger = logging.getLogger('django.request')

class RequestLogMiddleware:
    """
    Log requests that take longer than a threshold.
    Helps identify bottlenecks in production (Phase 8 optimization).
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold = 0.3  # 300ms as requested in Phase 8

    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = time.time() - start_time
        
        # Log slow requests (> 300ms)
        if duration > self.threshold:
            user = getattr(request, 'user', 'Anonymous')
            user_id = getattr(user, 'id', 'N/A')
            logger.warning(
                f"Slow Request: {request.method} {request.path} "
                f"took {duration:.3f}s | User: {user} (ID: {user_id}) | "
                f"Status: {response.status_code}"
            )
            
        # Log 4xx/5xx errors for debugging
        if response.status_code >= 400:
             user = getattr(request, 'user', 'Anonymous')
             user_id = getattr(user, 'id', 'N/A')
             lvl = logging.ERROR if response.status_code >= 500 else logging.WARNING
             logger.log(lvl,
                 f"API Error {response.status_code}: {request.method} {request.path} "
                 f"| User: {user} (ID: {user_id}) | IP: {request.META.get('REMOTE_ADDR')}"
             )

        return response

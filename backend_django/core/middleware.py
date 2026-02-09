import time
import logging
import threading

logger = logging.getLogger('django.request')

class RequestLogMiddleware:
    """
    Log requests that take longer than a threshold.
    Helps identify bottlenecks in production.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold = 0.5  # 500ms

    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = time.time() - start_time
        
        if duration > self.threshold:
            user = getattr(request, 'user', 'Anonymous')
            logger.warning(
                f"Slow Request: {request.method} {request.path} "
                f"took {duration:.2f}s | User: {user} | "
                f"Status: {response.status_code}"
            )
            
        return response

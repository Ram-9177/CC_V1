"""
core/middleware package
──────────────────────
Re-exports RequestLogMiddleware from the original module so existing settings
references to 'core.middleware.RequestLogMiddleware' keep working after this
directory was converted from a single file to a package.
"""

import time
import logging

logger = logging.getLogger('django.request')


class RequestLogMiddleware:
    """
    Log requests that take longer than threshold (500ms).
    Helps identify bottlenecks in production.
    Also logs 401/403 access-denied events with user + IP.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold = 1.0  # 1.0s (reduce noise for local/cold starts)

    def __call__(self, request):
        start_time = time.time()

        response = self.get_response(request)

        duration = time.time() - start_time

        if duration > self.threshold:
            # Skip noise for simple health checks unless they are extremely slow (> 3s)
            if request.path == '/api/health/' and duration < 3.0:
                return response

            user = getattr(request, 'user', 'Anonymous')
            user_id = getattr(user, 'id', 'N/A')
            logger.warning(
                f"Slow Request: {request.method} {request.path} "
                f"took {duration:.2f}s | User: {user} (ID: {user_id}) | "
                f"Status: {response.status_code}"
            )

        # Audit log for sensitive errors (401/403)
        if response.status_code in [401, 403]:
            user = getattr(request, 'user', 'Anonymous')
            user_id = getattr(user, 'id', 'N/A')
            is_anon = not getattr(user, 'is_authenticated', False)
            log_level = logging.WARNING
            
            # Lower noise for prospecting bots or unauthenticated browsing
            if response.status_code == 401 and is_anon:
                log_level = logging.INFO
                
            # Get real IP if behind proxy
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')

            logger.log(
                log_level,
                f"Access Denied: {request.method} {request.path} "
                f"| User: {user} (ID: {user_id}) | "
                f"Status: {response.status_code} | IP: {ip}"
            )

        return response

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

    Performance optimisation:
    After each authenticated request, populates a short-lived cache entry for
    the user's role so that DRF permission classes do NOT need to hit the DB
    to resolve the same value on the next request within the TTL window.
    Cost: zero extra DB queries — role is read from the already-resolved
    request.user object that Django/DRF populated during auth.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold = 1.0  # 1.0s (reduce noise for local/cold starts)

    def __call__(self, request):
        start_time = time.time()

        response = self.get_response(request)

        duration = time.time() - start_time

        # ── Role caching (zero-cost: user already resolved by DRF auth) ──
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            user_id = getattr(user, 'id', None)
            role = getattr(user, 'role', None)
            if user_id and role:
                try:
                    from core.services import set_cached_user_role
                    set_cached_user_role(user_id, role)
                except Exception:
                    pass  # Never block the response for caching failures

        if duration > self.threshold:
            # Skip noise for simple health checks unless they are extremely slow (> 3s)
            if request.path == '/api/health/' and duration < 3.0:
                return response

            user_disp = getattr(request, 'user', 'Anonymous')
            user_id = getattr(user_disp, 'id', 'N/A')
            logger.warning(
                f"Slow Request: {request.method} {request.path} "
                f"took {duration:.2f}s | User: {user_disp} (ID: {user_id}) | "
                f"Status: {response.status_code}"
            )

        # Audit log for sensitive errors (401/403)
        if response.status_code in [401, 403]:
            user_disp = getattr(request, 'user', 'Anonymous')
            user_id = getattr(user_disp, 'id', 'N/A')
            is_anon = not getattr(user_disp, 'is_authenticated', False)
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
                f"| User: {user_disp} (ID: {user_id}) | "
                f"Status: {response.status_code} | IP: {ip}"
            )

        return response

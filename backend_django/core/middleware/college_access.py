"""
College Access Middleware.

Checks whether the authenticated user's college is active.
If the college is disabled, returns 403 with a specific error code
so the frontend can show the appropriate disconnection message.

Exempt paths:
- Login / register / token refresh (handled by LoginSerializer)
- Logout (let users log out even if college is disabled)
- Static / media files
"""

import json
import logging
from django.http import JsonResponse

logger = logging.getLogger('django.request')

# Paths that should never be blocked by college status
EXEMPT_PREFIXES = (
    '/api/login',
    '/api/register',
    '/api/token',
    '/api/setup-admin',
    '/api/password-reset',
    '/admin/',
    '/static/',
    '/media/',
    '/ws/',
    '/health',
)

# Paths that should allow POST even when college is disabled (e.g., logout)
EXEMPT_EXACT = {
    '/api/logout/',
}


class CollegeAccessMiddleware:
    """
    Middleware that blocks access for users whose college is disabled.
    
    Must be placed AFTER AuthenticationMiddleware in the MIDDLEWARE list
    so that request.user is available.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip for unauthenticated users (login/register will handle it)
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        # Skip exempt paths
        path = request.path
        if path in EXEMPT_EXACT:
            return self.get_response(request)
        if any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
            return self.get_response(request)

        # Super admins are always exempt
        if getattr(user, 'role', '') == 'super_admin' or getattr(user, 'is_superuser', False):
            return self.get_response(request)

        # Users without a college are exempt
        college_id = getattr(user, 'college_id', None)
        if not college_id:
            return self.get_response(request)

        # Check college status (use cached FK if available)
        try:
            college = user.college
            if college and not college.is_active:
                reason = college.disabled_reason or ''
                msg = "Thank you. Your college is temporarily disconnected from HostelConnect."
                if reason:
                    msg += f" Reason: {reason}"
                
                return JsonResponse({
                    'detail': msg,
                    'code': 'COLLEGE_DISABLED',
                    'college_name': college.name,
                }, status=403)
        except Exception:
            # Don't block on DB errors — fail open
            logger.warning(f"CollegeAccessMiddleware: Failed to check college for user {user.id}")

        return self.get_response(request)

"""CollegeModuleMiddleware — block API access to disabled modules per college.

Maps URL path prefixes to module slugs.  When a college admin has disabled a
module via CollegeModuleConfig, any request to that module's API returns 403.

Exempt:
- super_admin / admin roles (they manage the system)
- Non-API paths (static, media, admin, ws)
- Login / token / health paths
"""

import logging
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Map URL prefix → module slug (must match core.rbac module constants)
_PATH_MODULE_MAP = {
    '/api/sports/':       'sports',
    '/api/hall-booking/': 'hall',
    '/api/gate-passes/':  'gatepass',
    '/api/gate-scans/':   'gatepass',
    '/api/leaves/':       'gatepass',
    '/api/meals/':        'meals',
    '/api/notices/':      'notices',
    '/api/complaints/':   'complaints',
    '/api/notifications/': 'notifications',
    '/api/reports/':      'reports',
    '/api/metrics/':      'reports',
    '/api/rooms/':        'hostel',
    '/api/attendance/':   'hostel',
    '/api/visitors/':     'security',
}

_EXEMPT_PREFIXES = (
    '/api/login', '/api/logout', '/api/token', '/api/register',
    '/api/setup-admin', '/api/password-reset', '/api/health',
    '/api/auth/', '/api/colleges/', '/api/users/', '/api/profile/',
    '/admin/', '/static/', '/media/', '/ws/',
)

_MANAGEMENT_ROLES = {'super_admin', 'admin'}


class CollegeModuleMiddleware:
    """Block requests to disabled modules for the user's college."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        path = request.path

        # Exempt management roles and non-API paths
        if getattr(user, 'is_superuser', False):
            return self.get_response(request)
        if getattr(user, 'role', '') in _MANAGEMENT_ROLES:
            return self.get_response(request)
        if any(path.startswith(p) for p in _EXEMPT_PREFIXES):
            return self.get_response(request)

        college = getattr(user, 'college', None)
        if not college:
            return self.get_response(request)

        # Determine which module this path belongs to
        module = None
        for prefix, mod in _PATH_MODULE_MAP.items():
            if path.startswith(prefix):
                module = mod
                break

        if module and not college.is_module_enabled(module):
            logger.info(
                "CollegeModuleMiddleware: blocked %s for college=%s module=%s",
                path, college.code, module,
            )
            return JsonResponse({
                'detail': f"The '{module}' module is not enabled for your institution.",
                'code': 'MODULE_DISABLED',
                'module': module,
            }, status=403)

        return self.get_response(request)

"""Path-level RBAC guard for module access control."""

from __future__ import annotations

from django.http import JsonResponse

from core.rbac import (
    MODULE_FEES,
    MODULE_GATEPASS,
    MODULE_HALL,
    MODULE_HOSTEL,
    MODULE_NOTICES,
    MODULE_SPORTS,
    has_module_permission,
)


class ModuleRBACMiddleware:
    """Enforce module permissions before DRF views execute."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_api_path(request.path) and request.user.is_authenticated:
            denied = self._deny_if_forbidden(request)
            if denied is not None:
                return denied
        return self.get_response(request)

    @staticmethod
    def _is_api_path(path: str) -> bool:
        return path.startswith('/api/') or path.startswith('/api/v1/')

    @staticmethod
    def _normalize_api_path(path: str) -> str:
        if path.startswith('/api/v1/'):
            return '/api/' + path[len('/api/v1/'):]
        return path

    def _deny_if_forbidden(self, request):
        path = self._normalize_api_path(request.path)
        method = request.method.upper()

        # Hostel module
        if path.startswith('/api/rooms/'):
            capability = 'view' if method in {'GET', 'HEAD', 'OPTIONS'} else 'manage'
            if not has_module_permission(request.user, MODULE_HOSTEL, capability):
                return self._deny('Hostel module access denied.')

        # Sports module
        if path.startswith('/api/events/'):
            if '/registrations/verify_qr/' in path or '/registrations/' in path and (
                path.endswith('/check_in/') or path.endswith('/cancel_entry/')
            ):
                capability = 'verify'
            elif '/registrations/' in path and method == 'POST':
                capability = 'participate'
            elif method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
                capability = 'manage'
            else:
                capability = 'view'

            if not has_module_permission(request.user, MODULE_SPORTS, capability):
                # HOD matrix allows apply-for-class-branch behavior for sports operations.
                if capability in {'participate', 'manage'} and has_module_permission(request.user, MODULE_SPORTS, 'apply'):
                    return None
                return self._deny('Sports module access denied.')

        # Hall module
        if path.startswith('/api/hall-booking/'):
            if method in {'GET', 'HEAD', 'OPTIONS'}:
                capability = 'view'
            elif '/bookings/' in path and method == 'POST':
                capability = 'request'
            elif path.endswith('/approve/') or path.endswith('/reject/'):
                capability = 'manage'
            else:
                capability = 'manage'

            if not has_module_permission(request.user, MODULE_HALL, capability):
                return self._deny('Hall module access denied.')

        # Fees module (disciplinary/fines)
        if path.startswith('/api/disciplinary/'):
            capability = 'view' if method in {'GET', 'HEAD', 'OPTIONS'} else 'manage'
            if not has_module_permission(request.user, MODULE_FEES, capability):
                if capability == 'view' and has_module_permission(request.user, MODULE_FEES, 'reports'):
                    return None
                return self._deny('Fees module access denied.')

        # Gatepass module
        if path.startswith('/api/gate-passes/') or path.startswith('/api/gate-scans/'):
            if any(path.endswith(suffix) for suffix in ['/verify/', '/mark_exit/', '/mark_entry/', '/scan_qr/', '/log_scan/']):
                capability = 'verify'
            elif any(path.endswith(suffix) for suffix in ['/approve/', '/reject/']):
                capability = 'approve'
            elif method == 'POST':
                capability = 'request'
            elif method in {'PUT', 'PATCH', 'DELETE'}:
                capability = 'manage'
            else:
                capability = 'view'

            if not has_module_permission(request.user, MODULE_GATEPASS, capability):
                if capability == 'manage' and has_module_permission(request.user, MODULE_GATEPASS, 'partial'):
                    return None
                return self._deny('Gatepass module access denied.')

        # Notices module
        if path.startswith('/api/notices/'):
            if method in {'GET', 'HEAD', 'OPTIONS'}:
                capability = 'view'
            else:
                capability = 'create'

            if not has_module_permission(request.user, MODULE_NOTICES, capability):
                # Scoped notice creators still map to create intent.
                if any(
                    has_module_permission(request.user, MODULE_NOTICES, scoped)
                    for scoped in ['broadcast', 'department_scope', 'hostel_scope', 'sports_scope']
                ):
                    return None
                return self._deny('Notices module access denied.')

        return None

    def _deny(self, message: str):
        return JsonResponse(
            {
                'detail': message,
                'code': 'RBAC_FORBIDDEN',
            },
            status=403,
        )

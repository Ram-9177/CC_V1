"""
College & Hostel Access Middleware.

Two-tier access gate that checks:
1. Is the user's COLLEGE active?
2. Is the user's assigned HOSTEL (Building) active?

If either is disabled, returns 403 with a specific error code
so the frontend can show the appropriate disconnection message.

Exempt:
- Super admins (they manage the system)
- Users without a college/hostel assignment
- Login / register / token refresh / logout paths
- Static / media files
"""

import logging
from django.http import JsonResponse

logger = logging.getLogger('django.request')

# Paths that should never be blocked by college/hostel status
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

# Paths that should allow POST even when disabled (e.g., logout)
EXEMPT_EXACT = {
    '/api/logout/',
}


def _get_user_allocation_context(user):
    """
    Get the user's active allocation context (Hostel, Building, Floor).
    Returns (hostel, building, floor_num) or (None, None, None).
    """
    try:
        from apps.rooms.models import RoomAllocation
        allocation = (
            RoomAllocation.objects
            .filter(
                student=user,
                end_date__isnull=True,
                status='approved'
            )
            .select_related('room__building__hostel')
            .only('room__floor', 
                  'room__building__id', 'room__building__is_active', 'room__building__disabled_reason', 'room__building__name', 'room__building__disabled_floors',
                  'room__building__hostel__id', 'room__building__hostel__is_active', 'room__building__hostel__disabled_reason', 'room__building__hostel__name')
            .first()
        )
        if allocation and allocation.room:
            room = allocation.room
            building = room.building
            hostel = building.hostel if building else None
            return hostel, building, room.floor
    except Exception:
        pass
    return None, None, None


class CollegeAccessMiddleware:
    """
    Middleware that blocks access based on a 4-tier hierarchy:
    1. College (handled in apps/colleges/models.py)
    2. Hostel (handled in apps/rooms/models.py - Hostel model)
    3. Block/Building (handled in apps/rooms/models.py - Building model)
    4. Floor (handled in apps/rooms/models.py - Building.disabled_floors)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        path = request.path
        if path in EXEMPT_EXACT or any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
            return self.get_response(request)

        # Super admins & Structural Authorities (Admins/Head Wardens) are exempt
        # from block/floor level locks to allow them to manage/fix issues.
        is_management = getattr(user, 'role', '') in ['super_admin', 'admin', 'head_warden']
        if getattr(user, 'is_superuser', False) or (is_management and 'hostels' not in path):
            return self.get_response(request)

        # ── TIER 1: College ──
        college = getattr(user, 'college', None)
        if college and not college.is_active:
            return JsonResponse({
                'detail': f"College Suspended: {college.disabled_reason or 'Access Restricted.'}",
                'code': 'COLLEGE_DISABLED',
                'college_name': college.name,
            }, status=403)

        # ── TIER 2, 3, 4: Hostel, Block, Floor ──
        # Only strict for students.
        if getattr(user, 'role', '') == 'student':
            hostel, building, floor_num = _get_user_allocation_context(user)
            
            # Tier 2: Hostel
            if hostel and not hostel.is_active:
                return JsonResponse({
                    'detail': f"Hostel Suspended: {hostel.disabled_reason or 'Access Restricted.'}",
                    'code': 'HOSTEL_DISABLED',
                    'hostel_name': hostel.name,
                }, status=403)

            # Tier 3: Block/Building
            if building and not building.is_active:
                return JsonResponse({
                    'detail': f"Block Suspended: {building.disabled_reason or 'Access Restricted.'}",
                    'code': 'BLOCK_DISABLED',
                    'block_name': building.name,
                }, status=403)

            # Tier 4: Floor
            if building and floor_num in (building.disabled_floors or []):
                return JsonResponse({
                    'detail': f"Floor {floor_num} Suspended: Access temporarily restricted for maintenance or policy reasons.",
                    'code': 'FLOOR_DISABLED',
                    'floor_num': floor_num,
                    'block_name': building.name,
                }, status=403)

        return self.get_response(request)

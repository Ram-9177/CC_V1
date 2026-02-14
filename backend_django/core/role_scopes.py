"""Role-based queryset scope helpers."""

from core.permissions import ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_SUPER_ADMIN, ROLE_WARDEN

TOP_LEVEL_MANAGEMENT_ROLES = {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN}


def user_is_top_level_management(user) -> bool:
    """Admins/super-admin/head-warden level access check."""
    return bool(user and getattr(user, 'role', None) in TOP_LEVEL_MANAGEMENT_ROLES)


def get_warden_building_ids(user):
    """
    Return building IDs assigned to a warden via active room allocations.
    Returns an empty values_list queryset when user is not a warden.
    """
    from apps.rooms.models import RoomAllocation

    if not user or getattr(user, 'role', None) != ROLE_WARDEN:
        return RoomAllocation.objects.none().values_list('room__building_id', flat=True)

    return RoomAllocation.objects.filter(
        student=user,
        end_date__isnull=True,
    ).values_list('room__building_id', flat=True)

"""Role-based queryset scope helpers."""

import uuid

from core.permissions import ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_SUPER_ADMIN, ROLE_WARDEN, ROLE_HR

TOP_LEVEL_MANAGEMENT_ROLES = {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN}


def _normalize_identifier(value):
    """Normalize IDs for UUID/int mixed deployments."""
    if value is None:
        return None
    value_str = str(value).strip()
    if not value_str:
        return None
    try:
        return str(uuid.UUID(value_str))
    except ValueError:
        return value_str


def _has_college_wide_scope_override(user) -> bool:
    """Return True when a scoped role has an explicit all-block override."""
    if not user:
        return False
    if getattr(user, 'role', None) not in {ROLE_WARDEN, ROLE_HR} and not getattr(user, 'is_student_hr', False):
        return False
    return bool(getattr(user, 'can_access_all_blocks', False) and getattr(user, 'college_id', None))


def user_is_top_level_management(user) -> bool:
    """Admins/super-admin/head-warden level access check."""
    return bool(user and getattr(user, 'role', None) in TOP_LEVEL_MANAGEMENT_ROLES)


def get_hr_building_ids(user):
    """Return building IDs explicitly assigned to this HR."""
    if not user or not (user.role == ROLE_HR or getattr(user, 'is_student_hr', False)):
        return []
    try:
        return list(user.assigned_blocks.all().values_list('id', flat=True))
    except AttributeError as exc:
        raise TypeError(
            f"user object of type {type(user).__name__!r} does not have "
            "a valid 'assigned_blocks' relation. Pass a proper User model instance."
        ) from exc


def get_hr_floor_numbers(user):
    """Return floor numbers explicitly assigned to this HR."""
    if not user or not (user.role == ROLE_HR or getattr(user, 'is_student_hr', False)):
        return []
    return user.assigned_floors or []


def get_warden_building_ids(user):
    """
    Return building IDs assigned to a warden.
    Includes explicit assignments (assigned_blocks) and dynamically allocated buildings.

    Raises:
        TypeError: if user is not a proper Django User model instance
                   (e.g. a SimpleNamespace passed by mistake).
    """
    buildings = []
    if not user:
        return buildings

    if _has_college_wide_scope_override(user):
        from apps.rooms.models import Building
        return list(
            Building.objects.filter(college_id=user.college_id).values_list('id', flat=True)
        )

    # Explicit assignments (Preferred for HR/Warden)
    if user.role in [ROLE_WARDEN, ROLE_HR] or getattr(user, 'is_student_hr', False):
        try:
            buildings.extend(list(user.assigned_blocks.all().values_list('id', flat=True)))
        except AttributeError as exc:
            raise TypeError(
                f"user object of type {type(user).__name__!r} does not have "
                "a valid 'assigned_blocks' relation. Pass a proper User model instance."
            ) from exc

    return list(set(buildings))


def has_scope_access(user, building_id=None, floor=None) -> bool:
    """
    Check if a user has authority over a specific building and/or floor.
    Hierarchy enforced.
    """
    if not user or not user.is_authenticated:
        return False

    # 1. Top Level Management sees all
    if user_is_top_level_management(user):
        return True

    # 1.5 Scoped role override: college-wide block visibility.
    if _has_college_wide_scope_override(user):
        if building_id is None:
            return True
        from apps.rooms.models import Building
        normalized_building_id = _normalize_identifier(building_id)
        if normalized_building_id is None:
            return False
        return Building.objects.filter(id=normalized_building_id, college_id=user.college_id).exists()

    # 2. Warden access check (Block level)
    if user.role == ROLE_WARDEN:
        assigned_buildings = get_warden_building_ids(user)
        if not building_id:  # General access to warden tools
            return len(assigned_buildings) > 0
        normalized_building_id = _normalize_identifier(building_id)
        assigned_set = {_normalize_identifier(bid) for bid in assigned_buildings}
        return normalized_building_id in assigned_set

    # 3. HR access check (Block + Floor level)
    if user.role == ROLE_HR or getattr(user, 'is_student_hr', False):
        assigned_buildings = get_hr_building_ids(user)
        assigned_floors = get_hr_floor_numbers(user)

        # Must have block access
        if building_id:
            normalized_building_id = _normalize_identifier(building_id)
            assigned_set = {_normalize_identifier(bid) for bid in assigned_buildings}
            if normalized_building_id not in assigned_set:
                return False

        # If floor is specified, must have floor access
        if floor is not None and len(assigned_floors) > 0:
            return int(floor) in [int(f) for f in assigned_floors]

        return len(assigned_buildings) > 0

    return False

"""Role-based queryset scope helpers."""

import uuid
from django.db.models import Q

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


def _normalize_floor_list(raw_floors):
    if not isinstance(raw_floors, list):
        return []
    normalized = []
    for floor in raw_floors:
        try:
            floor_num = int(floor)
        except (TypeError, ValueError):
            continue
        if floor_num >= 1:
            normalized.append(floor_num)
    return sorted(set(normalized))


def _get_floor_scope_map(user):
    """Return normalized {building_id: [floors...]} map for scoped hostel roles."""
    if not user:
        return {}

    if getattr(user, 'role', None) not in {ROLE_WARDEN, ROLE_HR} and not getattr(user, 'is_student_hr', False):
        return {}

    raw_map = getattr(user, 'assigned_floors_by_block', {}) or {}
    if not isinstance(raw_map, dict):
        return {}

    normalized = {}
    for building_id, floors in raw_map.items():
        key = _normalize_identifier(building_id)
        if key is None:
            continue
        normalized[key] = _normalize_floor_list(floors)

    return normalized


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

    floor_map = _get_floor_scope_map(user)
    combined = set()
    for floors in floor_map.values():
        combined.update(floors)
    return sorted(combined)


def get_floor_numbers_for_building(user, building_id):
    """Return scoped floor numbers for a specific building."""
    normalized_building_id = _normalize_identifier(building_id)
    if normalized_building_id is None:
        return []
    return _get_floor_scope_map(user).get(normalized_building_id, [])


def get_scoped_building_floor_pairs(user):
    """Return normalized building -> floors pairs where floors are explicitly granted."""
    if not user:
        return {}

    if _has_college_wide_scope_override(user):
        return {
            _normalize_identifier(building_id): []
            for building_id in get_warden_building_ids(user)
            if _normalize_identifier(building_id) is not None
        }

    building_ids = {
        _normalize_identifier(building_id)
        for building_id in get_warden_building_ids(user)
    }
    building_ids.discard(None)

    floor_map = _get_floor_scope_map(user)
    scoped_pairs = {}
    for building_id in building_ids:
        floors = floor_map.get(building_id, [])
        if floors:
            scoped_pairs[building_id] = floors

    return scoped_pairs


def build_scoped_building_floor_q(user, *, building_lookup: str, floor_lookup: str):
    """
    Build a strict OR query for scoped Warden/HR access:
    (building=A AND floor in floorsA) OR (building=B AND floor in floorsB)...
    """
    if not user:
        return Q(pk__in=[])

    if _has_college_wide_scope_override(user):
        building_ids = get_warden_building_ids(user)
        if not building_ids:
            return Q(pk__in=[])
        return Q(**{f'{building_lookup}__in': building_ids})

    scoped_pairs = get_scoped_building_floor_pairs(user)
    if not scoped_pairs:
        return Q(pk__in=[])

    scoped_q = Q(pk__in=[])
    for building_id, floors in scoped_pairs.items():
        scoped_q |= (Q(**{building_lookup: building_id}) & Q(**{f'{floor_lookup}__in': floors}))

    return scoped_q


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
    if user.role in {ROLE_WARDEN, ROLE_HR} or getattr(user, 'is_student_hr', False):
        scoped_pairs = get_scoped_building_floor_pairs(user)
        if building_id is None:
            return bool(scoped_pairs)

        normalized_building_id = _normalize_identifier(building_id)
        if normalized_building_id not in scoped_pairs:
            return False

        floors_for_building = scoped_pairs.get(normalized_building_id, [])
        if floor is None:
            return bool(floors_for_building)

        try:
            requested_floor = int(floor)
        except (TypeError, ValueError):
            return False
        return requested_floor in floors_for_building

    return False

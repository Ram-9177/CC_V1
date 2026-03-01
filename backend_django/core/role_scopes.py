"""Role-based queryset scope helpers."""

from core.permissions import ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_SUPER_ADMIN, ROLE_WARDEN, ROLE_HR

TOP_LEVEL_MANAGEMENT_ROLES = {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN}


def user_is_top_level_management(user) -> bool:
    """Admins/super-admin/head-warden level access check."""
    return bool(user and getattr(user, 'role', None) in TOP_LEVEL_MANAGEMENT_ROLES)


def get_hr_building_ids(user):
    """Return building IDs explicitly assigned to this HR."""
    if not user or not (user.role == ROLE_HR or getattr(user, 'is_student_hr', False)):
        return []
    return list(user.assigned_blocks.all().values_list('id', flat=True))


def get_hr_floor_numbers(user):
    """Return floor numbers explicitly assigned to this HR."""
    if not user or not (user.role == ROLE_HR or getattr(user, 'is_student_hr', False)):
        return []
    return user.assigned_floors or []


def get_warden_building_ids(user):
    """
    Return building IDs assigned to a warden.
    Includes explicit assignments (assigned_blocks) and dynamically allocated buildings.
    """
    buildings = []
    if not user:
        return buildings

    # Explicit assignments (Preferred for HR/Warden)
    if user.role in [ROLE_WARDEN, ROLE_HR] or getattr(user, 'is_student_hr', False):
        buildings.extend(list(user.assigned_blocks.all().values_list('id', flat=True)))

    # Fallback to dynamic allocation if no explicit blocks assigned but they are a Warden
    if not buildings and user.role == ROLE_WARDEN:
        from apps.rooms.models import RoomAllocation
        buildings.extend(list(RoomAllocation.objects.filter(
            student=user,
            end_date__isnull=True,
        ).values_list('room__building_id', flat=True)))
    
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
    
    # 2. Warden access check (Block level)
    if user.role == ROLE_WARDEN:
        assigned_buildings = get_warden_building_ids(user)
        if not building_id: # General access to warden tools
            return len(assigned_buildings) > 0
        return int(building_id) in assigned_buildings

    # 3. HR access check (Block + Floor level)
    if user.role == ROLE_HR or getattr(user, 'is_student_hr', False):
        assigned_buildings = get_hr_building_ids(user)
        assigned_floors = get_hr_floor_numbers(user)
        
        # Must have block access
        if building_id and int(building_id) not in assigned_buildings:
            return False
            
        # If floor is specified, must have floor access
        if floor is not None and len(assigned_floors) > 0:
            return int(floor) in [int(f) for f in assigned_floors]
            
        return len(assigned_buildings) > 0

    return False

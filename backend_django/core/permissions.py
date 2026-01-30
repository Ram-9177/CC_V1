"""Custom permissions for DRF."""

from rest_framework import permissions


def user_is_admin(user) -> bool:
    return bool(user and (user.groups.filter(name='Admin').exists() or user.is_staff or user.is_superuser))


def user_is_staff(user) -> bool:
    return bool(user and user.groups.filter(name='Staff').exists())


def user_is_student(user) -> bool:
    return bool(user and user.groups.filter(name='Student').exists())


class IsAdmin(permissions.BasePermission):
    """Permission to check if user is admin."""
    
    def has_permission(self, request, view):
        return bool(
            request.user
            and (
                request.user.groups.filter(name='Admin').exists()
                or request.user.is_staff
                or request.user.is_superuser
            )
        )


class IsWarden(permissions.BasePermission):
    """Permission to check if user is a warden."""
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.groups.filter(name='Staff').exists())


class IsChef(permissions.BasePermission):
    """Permission to check if user is a chef."""
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.groups.filter(name='Staff').exists())


class IsStudent(permissions.BasePermission):
    """Permission to check if user is a student."""
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.groups.filter(name='Student').exists())


class IsReadOnly(permissions.BasePermission):
    """Allow read-only access."""
    
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsGateStaff(permissions.BasePermission):
    """Permission to check if user is gate staff."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.groups.filter(name='Staff').exists())

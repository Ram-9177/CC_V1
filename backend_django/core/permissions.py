"""Custom permissions for DRF."""

from rest_framework import permissions

# ===== ROLE CONSTANTS - CENTRALIZED SOURCE OF TRUTH =====
ROLE_SUPER_ADMIN = 'super_admin'
ROLE_ADMIN = 'admin'
ROLE_HEAD_WARDEN = 'head_warden'
ROLE_WARDEN = 'warden'
ROLE_STAFF = 'staff'
ROLE_CHEF = 'chef'
ROLE_SECURITY_HEAD = 'security_head'
ROLE_GATE_SECURITY = 'gate_security'
ROLE_STUDENT = 'student'

# Role Groups - for easier permission checking
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
AUTHORITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
STAFF_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN, ROLE_STAFF]
SECURITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
GATE_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
WARDEN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
MANAGEMENT_ROLES = AUTHORITY_ROLES + [ROLE_STAFF]


def user_is_admin(user) -> bool:
    """Check if user is admin or super_admin."""
    if not user: 
        return False
    return user.role in ADMIN_ROLES or user.is_superuser


def user_is_super_admin(user) -> bool:
    """Check if user is super_admin only."""
    if not user:
        return False
    return user.role == ROLE_SUPER_ADMIN or user.is_superuser


def user_is_staff(user) -> bool:
    """Check if user is staff-level or higher."""
    if not user:
        return False
    return user.role in STAFF_ROLES


def user_is_student(user) -> bool:
    """Check if user is a student."""
    if not user:
        return False
    return user.role == ROLE_STUDENT


def user_is_warden(user) -> bool:
    """Check if user is warden or higher authority."""
    if not user:
        return False
    return user.role in WARDEN_ROLES


def user_is_security(user) -> bool:
    """Check if user is security personnel."""
    if not user:
        return False
    return user.role in SECURITY_ROLES


class IsAdmin(permissions.BasePermission):
    """Permission to check if user is admin or super_admin."""
    def has_permission(self, request, view):
        return user_is_admin(request.user)


class IsSuperAdmin(permissions.BasePermission):
    """Permission to check if user is super_admin only."""
    def has_permission(self, request, view):
        return user_is_super_admin(request.user)


class IsWarden(permissions.BasePermission):
    """Permission to check if user is warden or higher authority."""
    def has_permission(self, request, view):
        return user_is_warden(request.user)


class IsStaff(permissions.BasePermission):
    """Permission to check if user is staff-level or higher."""
    def has_permission(self, request, view):
        return user_is_staff(request.user)


class IsChef(permissions.BasePermission):
    """Permission to check if user is a chef."""
    def has_permission(self, request, view):
        if not request.user:
            return False
        return request.user.role in [ROLE_CHEF, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsGateSecurity(permissions.BasePermission):
    """Permission to check if user is gate security or higher."""
    def has_permission(self, request, view):
        if not request.user:
            return False
        return request.user.role in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsSecurityHead(permissions.BasePermission):
    """Permission to check if user is security head."""
    def has_permission(self, request, view):
        if not request.user:
            return False
        return request.user.role in [ROLE_SECURITY_HEAD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsStudent(permissions.BasePermission):
    """Permission to check if user is a student."""
    def has_permission(self, request, view):
        return user_is_student(request.user)


class IsReadOnly(permissions.BasePermission):
    """Allow read-only access."""
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow resource owners and admins to access."""
    
    def has_object_permission(self, request, view, obj):
        # Allow admin/staff to access all objects
        if user_is_admin(request.user):
            return True
        
        # Allow object owner to access
        if hasattr(obj, 'student_id') and obj.student_id == request.user.id:
            return True
        if hasattr(obj, 'student') and hasattr(obj.student, 'id') and obj.student.id == request.user.id:
            return True
        if hasattr(obj, 'user_id') and obj.user_id == request.user.id:
            return True
        if hasattr(obj, 'owner_id') and obj.owner_id == request.user.id:
            return True
        
        return False


class CanViewGatePasses(permissions.BasePermission):
    """
    Allow viewing gate passes based on role:
    - Admins/Wardens: see all
    - Gate Security: see all
    - Students: see their own
    """
    
    def has_object_permission(self, request, view, obj):
        # Authority roles can see all
        if request.user.role in AUTHORITY_ROLES + SECURITY_ROLES:
            return True
        
        # Students can only see their own
        if request.user.role == ROLE_STUDENT:
            return obj.student_id == request.user.id
        
        return False


class AdminOrReadOnly(permissions.BasePermission):
    """Admin write, anyone read."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return user_is_admin(request.user)

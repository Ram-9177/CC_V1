"""Custom permissions for DRF."""

from rest_framework import permissions

# ===== ROLE CONSTANTS - CENTRALIZED SOURCE OF TRUTH =====
ROLE_SUPER_ADMIN = 'super_admin'
ROLE_ADMIN = 'admin'
ROLE_HEAD_WARDEN = 'head_warden'
ROLE_WARDEN = 'warden'
ROLE_HR = 'hr'
ROLE_STAFF = 'staff'
ROLE_CHEF = 'chef'
ROLE_HEAD_CHEF = 'head_chef'
ROLE_SECURITY_HEAD = 'security_head'
ROLE_GATE_SECURITY = 'gate_security'
ROLE_STUDENT = 'student'

# Role Groups - for easier permission checking
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
AUTHORITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
HR_ROLES = [ROLE_HR]
STAFF_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN, ROLE_HR, ROLE_STAFF, ROLE_CHEF, ROLE_HEAD_CHEF]
SECURITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
GATE_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
WARDEN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
CHEF_ROLES = [ROLE_CHEF, ROLE_HEAD_CHEF]
MANAGEMENT_ROLES = WARDEN_ROLES + HR_ROLES + [ROLE_STAFF]
TOP_LEVEL_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN]


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


def user_is_top_level_management(user) -> bool:
    """Check if user is SuperAdmin, Admin, or Head Warden."""
    if not user:
        return False
    return user.role in TOP_LEVEL_ROLES or user.is_superuser


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


class IsStructuralAuthority(permissions.BasePermission):
    """Permission to check if user is SuperAdmin, Admin, or Head Warden (Structural Authority)."""
    def has_permission(self, request, view):
        return user_is_top_level_management(request.user)


class IsStaff(permissions.BasePermission):
    """Permission to check if user is staff-level or higher."""
    def has_permission(self, request, view):
        return user_is_staff(request.user)


class IsTopLevel(permissions.BasePermission):
    """Permission to check if user is admin, super_admin, or head_warden."""
    def has_permission(self, request, view):
        return user_is_top_level_management(request.user)


class IsChef(permissions.BasePermission):
    """Permission to check if user is a chef."""
    def has_permission(self, request, view):
        if not request.user:
            return False
        return request.user.role in [ROLE_CHEF, ROLE_HEAD_CHEF, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsGateSecurity(permissions.BasePermission):
    """Permission to check if user is gate security or higher."""
    def has_permission(self, request, view):
        if not request.user:
            return False
        return request.user.role in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class CanViewGatePasses(permissions.BasePermission):
    """Permission to check if user can view gate passes (Management + Security + HR)."""
    def has_permission(self, request, view):
        user = request.user
        return user.role in [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY, ROLE_HR] or getattr(user, 'is_student_hr', False)


class IsManagement(permissions.BasePermission):
    """Permission to check if user is admin, warden, or management staff (excludes chefs/security)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in MANAGEMENT_ROLES


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


class IsSecurityPersonnel(permissions.BasePermission):
    """Permission to check if user is ONLY gate security or security head (no Admins/Wardens)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD]


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


def user_is_hr(user) -> bool:
    """Check if user has HR authority (direct role or student hr)."""
    if not user:
        return False
    return user.role == ROLE_HR or getattr(user, 'is_student_hr', False)


class IsHR(permissions.BasePermission):
    """Permission to check if user has HR authority."""
    def has_permission(self, request, view):
        return user_is_hr(request.user)


class IsStudentHR(permissions.BasePermission):
    """Permission to check if user is a Student HR Rep (Model Field priority)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Admins/Staff always have this permission
        if user_is_staff(request.user) or user_is_admin(request.user):
            return True
        return getattr(request.user, 'is_student_hr', False) or request.user.groups.filter(name='Student_HR').exists()


class PasswordChangeRequired(permissions.BasePermission):
    """
    Enforces password change for all authenticated users.
    Blocks access to everything except:
    - Change Password
    - Logout
    - Profile (Read-only for context)
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            # Let other permissions handle unauthenticated access
            return True
        
        # If password is changed, allow access
        if getattr(request.user, 'is_password_changed', True):
            return True
        
        # If password NOT changed, white-list specific actions
        current_path = request.path
        method = request.method
        
        # Allow password change endpoints
        if 'change_password' in current_path or 'change-password' in current_path:
            return True
            
        # Allow logout and token refresh
        if 'logout' in current_path or 'token/refresh' in current_path:
             return True
        
        # Allow profile read and unread counts (safe layout data)
        if ('profile' in current_path or 'unread' in current_path) and method in permissions.SAFE_METHODS:
             return True
             
        # Block everything else
        return False


"""Custom permissions for DRF."""

from typing import Optional

from rest_framework import permissions
from core.rbac import has_module_permission

# ===== ROLE CONSTANTS - CENTRALIZED SOURCE OF TRUTH =====
ROLE_SUPER_ADMIN = 'super_admin'
ROLE_ADMIN = 'admin'
ROLE_HEAD_WARDEN = 'head_warden'
ROLE_WARDEN = 'warden'
ROLE_PRINCIPAL = 'principal'
ROLE_DIRECTOR = 'director'
ROLE_HOD = 'hod'
ROLE_INCHARGE = 'incharge'
ROLE_HR = 'hr'
ROLE_STAFF = 'staff'
ROLE_CHEF = 'chef'
ROLE_HEAD_CHEF = 'head_chef'
ROLE_SECURITY_HEAD = 'security_head'
ROLE_GATE_SECURITY = 'gate_security'
ROLE_PD = 'pd'
ROLE_PT = 'pt'
ROLE_STUDENT = 'student'

# Role Groups - for easier permission checking
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
AUTHORITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
HR_ROLES = [ROLE_HR]
STAFF_ROLES = [
    ROLE_SUPER_ADMIN,
    ROLE_ADMIN,
    ROLE_PRINCIPAL,
    ROLE_DIRECTOR,
    ROLE_HOD,
    ROLE_HEAD_WARDEN,
    ROLE_WARDEN,
    ROLE_INCHARGE,
    ROLE_HR,
    ROLE_STAFF,
    ROLE_CHEF,
    ROLE_HEAD_CHEF,
    ROLE_PD,
    ROLE_PT,
]
SECURITY_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
GATE_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_HEAD, ROLE_GATE_SECURITY]
WARDEN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN, ROLE_WARDEN]
SPORTS_ROLES = [ROLE_PD, ROLE_PT, ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_INCHARGE]
CHEF_ROLES = [ROLE_CHEF, ROLE_HEAD_CHEF]
MANAGEMENT_ROLES = WARDEN_ROLES + HR_ROLES + [ROLE_STAFF, ROLE_PRINCIPAL, ROLE_DIRECTOR, ROLE_HOD, ROLE_INCHARGE]
TOP_LEVEL_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_HEAD_WARDEN]
STUDENT_ROLES = [ROLE_STUDENT]


def user_is_admin(user) -> bool:
    """Check if user is admin or super_admin."""
    if not getattr(user, 'is_authenticated', False): 
        return False
    return getattr(user, 'role', None) in ADMIN_ROLES or getattr(user, 'is_superuser', False)


def user_is_super_admin(user) -> bool:
    """Check if user is super_admin only."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) == ROLE_SUPER_ADMIN or getattr(user, 'is_superuser', False)


def user_is_staff(user) -> bool:
    """Check if user is staff-level or higher."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) in STAFF_ROLES


def user_is_top_level_management(user) -> bool:
    """Check if user is SuperAdmin, Admin, or Head Warden."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) in TOP_LEVEL_ROLES or getattr(user, 'is_superuser', False)


def user_is_student(user) -> bool:
    """Check if user is a student."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) == ROLE_STUDENT


def user_is_warden(user) -> bool:
    """Check if user is warden or higher authority."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) in WARDEN_ROLES


def user_is_security(user) -> bool:
    """Check if user is security personnel."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return getattr(user, 'role', None) in SECURITY_ROLES


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


class IsHeadWarden(permissions.BasePermission):
    """Permission to check if user is head warden or admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [ROLE_HEAD_WARDEN, ROLE_ADMIN, ROLE_SUPER_ADMIN]


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


class IsSportsAuthority(permissions.BasePermission):
    """Permission to check if user is PD, PT, or Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in SPORTS_ROLES

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


class IsPD(permissions.BasePermission):
    """Physical Director (or admin) — sports authority with full management rights."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [ROLE_PD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsPT(permissions.BasePermission):
    """Trainer (PT) and above — can perform QR check-in and view schedules."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [ROLE_PT, ROLE_PD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


class IsHOD(permissions.BasePermission):
    """Head of Department — can submit department sports requests."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [ROLE_HOD, ROLE_ADMIN, ROLE_SUPER_ADMIN]


# ---------------------------------------------------------------------------
# RBAC module-capability permission wrappers (extension layer)
# ---------------------------------------------------------------------------

class _RBACModulePermission(permissions.BasePermission):
    """Base permission that checks RBAC capabilities via core.rbac.

    Usage options:
    - Subclass and set ``module`` + ``capability`` class attrs.
    - Or set ``view.rbac_module`` and optionally ``view.rbac_capability``.
    """

    module: Optional[str] = None
    capability: str = 'view'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False

        module = self.module or getattr(view, 'rbac_module', None)
        capability = getattr(view, 'rbac_capability', self.capability)
        if not module:
            return False

        return has_module_permission(user, module, capability)


class CanViewModule(_RBACModulePermission):
    capability = 'view'


class CanCreateModule(_RBACModulePermission):
    capability = 'create'


class CanManageModule(_RBACModulePermission):
    capability = 'manage'


class CanApproveModule(_RBACModulePermission):
    capability = 'approve'


class CanViewReportsModule(CanViewModule):
    module: Optional[str] = 'reports'


class CanManageReportsModule(CanManageModule):
    module: Optional[str] = 'reports'


class CanViewSecurityModule(CanViewModule):
    module: Optional[str] = 'security'


class CanManageSecurityModule(CanManageModule):
    module: Optional[str] = 'security'


class CanViewHostelModule(CanViewModule):
    module: Optional[str] = 'hostel'


class CanManageHostelModule(CanManageModule):
    module: Optional[str] = 'hostel'


class CanViewGatePasses(permissions.BasePermission):
    """
    Allow viewing gate passes based on role:
    - Admins/Wardens: see all
    - Gate Security: see all
    - Students: see their own
    - HR/Student HR: see students in their scope (handled by queryset)
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # All authenticated roles can access the list/retrieve with correct queryset filtering
        return True
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        # Authority roles can see all
        if user.role in AUTHORITY_ROLES + SECURITY_ROLES + HR_ROLES:
            return True
        
        # Student HRs can see all (queryset will limit them to their scope)
        if getattr(user, 'is_student_hr', False) or user.groups.filter(name='Student_HR').exists():
            return True

        # Students can only see their own
        if user.role == ROLE_STUDENT:
            return obj.student_id == user.id
        
        return False


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


class AdminOrReadOnly(permissions.BasePermission):
    """Admin write, anyone read."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return user_is_admin(request.user)


def user_is_hr(user) -> bool:
    """Check if user has HR authority (direct role or student hr rep)."""
    if not getattr(user, 'is_authenticated', False):
        return False
    # Direct HR role
    if getattr(user, 'role', None) == ROLE_HR:
        return True
    # Student HR reps (Model attribute or Auth Group)
    if getattr(user, 'is_student_hr', False):
        return True
    return user.groups.filter(name='Student_HR').exists()


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


class IsSecurity(permissions.BasePermission):
    """Permission to check if user is security personnel (includes admins)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in SECURITY_ROLES


# ─────────────────────────────────────────────────────────────────────────────
# Student Type Permissions
# ─────────────────────────────────────────────────────────────────────────────

def is_hosteller(user) -> bool:
    """Fast boolean check — True if user is a hosteller student."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return (
        getattr(user, 'role', None) == ROLE_STUDENT
        and getattr(user, 'student_type', None) == 'hosteller'
    )


def is_day_scholar(user) -> bool:
    """Fast boolean check — True if user is a day scholar student."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return (
        getattr(user, 'role', None) == ROLE_STUDENT
        and getattr(user, 'student_type', None) == 'day_scholar'
    )


class IsHosteller(permissions.BasePermission):
    """
    DRF permission that blocks day scholars from hostel-only endpoints.

    Usage on any hostel-facing view::

        permission_classes = [IsAuthenticated, IsHosteller]

    Staff roles (warden, admin, etc.) always pass — only students are gated.
    """
    message = "This feature is only available to hostellers."

    def has_permission(self, request, view):
        user = request.user
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        # Non-student staff always have access to hostel endpoints
        if getattr(user, 'role', None) != ROLE_STUDENT:
            return True
        return is_hosteller(user)


class IsDayScholar(permissions.BasePermission):
    """Restrict to day scholars only (e.g., off-campus features)."""
    message = "This feature is only available to day scholars."

    def has_permission(self, request, view):
        user = request.user
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if getattr(user, 'role', None) != ROLE_STUDENT:
            return True
        return is_day_scholar(user)

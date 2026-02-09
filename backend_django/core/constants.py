"""
Centralized role definitions and groupings.

IMPORTANT: Update HERE when adding new roles, not scattered across codebase.
"""

class UserRoles:
    """User role constants - matches User.ROLE_CHOICES in auth.models"""
    
    # Individual roles
    STUDENT = 'student'
    STAFF = 'staff'
    ADMIN = 'admin'
    SUPER_ADMIN = 'super_admin'
    HEAD_WARDEN = 'head_warden'
    WARDEN = 'warden'
    CHEF = 'chef'
    GATE_SECURITY = 'gate_security'
    SECURITY_HEAD = 'security_head'
    
    # Role groupings for permissions and broadcasts
    MANAGEMENT_ROLES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF]
    SECURITY_ROLES = [GATE_SECURITY, SECURITY_HEAD]
    ALL_STAFF_ROLES = MANAGEMENT_ROLES + SECURITY_ROLES + [CHEF]
    
    # Common broadcast targets
    BROADCAST_MANAGEMENT = MANAGEMENT_ROLES + SECURITY_ROLES  # Everyone who manages system
    BROADCAST_ROOM_UPDATES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF, CHEF]
    BROADCAST_GATE_UPDATES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF, GATE_SECURITY, SECURITY_HEAD]
    
    @classmethod
    def is_staff_role(cls, role: str) -> bool:
        """Check if role is ANY staff role (non-student)"""
        return role in cls.ALL_STAFF_ROLES
    
    @classmethod
    def is_management_role(cls, role: str) -> bool:
        """Check if role is management (can approve, manage data)"""
        return role in cls.MANAGEMENT_ROLES
    
    @classmethod
    def is_security_role(cls, role: str) -> bool:
        """Check if role is security (gate-related)"""
        return role in cls.SECURITY_ROLES


# Export for easy imports
STUDENT = UserRoles.STUDENT
MANAGEMENT_ROLES = UserRoles.MANAGEMENT_ROLES
ALL_STAFF_ROLES = UserRoles.ALL_STAFF_ROLES
BROADCAST_MANAGEMENT = UserRoles.BROADCAST_MANAGEMENT
BROADCAST_GATE_UPDATES = UserRoles.BROADCAST_GATE_UPDATES

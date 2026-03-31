"""
Centralized role definitions and groupings.

IMPORTANT: Update HERE when adding new roles, not scattered across codebase.

All roles in the system live here. core/permissions.py imports from here.
Do NOT define role name strings anywhere else.
"""

class UserRoles:
    """User role constants — single source of truth for every role string."""

    # ── Core Administrative ───────────────────────────────────────────────────
    SUPER_ADMIN = 'super_admin'
    ADMIN = 'admin'

    # ── Institutional Leadership ──────────────────────────────────────────────
    PRINCIPAL = 'principal'
    DIRECTOR = 'director'
    HOD = 'hod'              # Head of Department
    INCHARGE = 'incharge'    # Hostel In-Charge

    # ── Hostel Management ─────────────────────────────────────────────────────
    HEAD_WARDEN = 'head_warden'
    WARDEN = 'warden'
    HR = 'hr'                # Hostel HR / Student Affairs
    STAFF = 'staff'          # General hostel staff

    # ── Security ─────────────────────────────────────────────────────────────
    SECURITY_HEAD = 'security_head'
    GATE_SECURITY = 'gate_security'

    # ── Kitchen ──────────────────────────────────────────────────────────────
    HEAD_CHEF = 'head_chef'
    CHEF = 'chef'

    # ── Sports ───────────────────────────────────────────────────────────────
    PD = 'pd'   # Physical Director
    PT = 'pt'   # Physical Trainer

    # ── Student ──────────────────────────────────────────────────────────────
    STUDENT = 'student'

    # ── Complete ordered list (highest → lowest authority) ────────────────────
    ALL_ROLES = [
        SUPER_ADMIN, ADMIN,
        PRINCIPAL, DIRECTOR, HOD, INCHARGE,
        HEAD_WARDEN, WARDEN, HR, STAFF,
        SECURITY_HEAD, GATE_SECURITY,
        HEAD_CHEF, CHEF,
        PD, PT,
        STUDENT,
    ]

    # ── Role Weight (for hierarchy enforcement: higher = more authority) ───────
    # Used by: auth/views.py ROLE_WEIGHTS, escalation logic, complaint routing
    ROLE_WEIGHTS: dict = {
        SUPER_ADMIN:    100,
        ADMIN:          90,
        PRINCIPAL:      80,
        DIRECTOR:       75,
        HOD:            70,
        HEAD_WARDEN:    60,
        INCHARGE:       55,
        WARDEN:         50,
        HR:             45,
        STAFF:          40,
        SECURITY_HEAD:  35,
        HEAD_CHEF:      30,
        GATE_SECURITY:  25,
        CHEF:           20,
        PD:             20,
        PT:             15,
        STUDENT:        0,
    }

    # ── Role Groupings ────────────────────────────────────────────────────────
    MANAGEMENT_ROLES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF]
    AUTHORITY_ROLES  = [SUPER_ADMIN, ADMIN, HEAD_WARDEN, WARDEN]      # Can approve gate passes
    LEADERSHIP_ROLES = [SUPER_ADMIN, ADMIN, PRINCIPAL, DIRECTOR, HOD, HEAD_WARDEN, INCHARGE]
    SECURITY_ROLES   = [GATE_SECURITY, SECURITY_HEAD]
    KITCHEN_ROLES    = [CHEF, HEAD_CHEF]
    PHYSICAL_EDUCATION = [PD, PT]
    HR_ROLES         = [HR]
    ALL_STAFF_ROLES  = (
        MANAGEMENT_ROLES + LEADERSHIP_ROLES + SECURITY_ROLES +
        KITCHEN_ROLES + PHYSICAL_EDUCATION + HR_ROLES
    )

    # ── Common broadcast targets ──────────────────────────────────────────────
    BROADCAST_MANAGEMENT  = MANAGEMENT_ROLES + SECURITY_ROLES  # Everyone who manages system
    BROADCAST_ROOM_UPDATES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF, HEAD_CHEF, CHEF]
    BROADCAST_GATE_UPDATES = [ADMIN, SUPER_ADMIN, WARDEN, HEAD_WARDEN, STAFF, GATE_SECURITY, SECURITY_HEAD]
    # Complaint escalation targets by severity
    COMPLAINT_CRITICAL_TARGETS = [HEAD_WARDEN, ADMIN, SUPER_ADMIN]  # critical/high
    COMPLAINT_STANDARD_TARGETS = [WARDEN]                            # medium/low

    # ── Helper class-methods ─────────────────────────────────────────────────
    @classmethod
    def is_staff_role(cls, role: str) -> bool:
        """Check if role is ANY staff role (non-student)."""
        return role in cls.ALL_STAFF_ROLES

    @classmethod
    def is_management_role(cls, role: str) -> bool:
        """Check if role can approve/manage data."""
        return role in cls.MANAGEMENT_ROLES

    @classmethod
    def is_security_role(cls, role: str) -> bool:
        """Check if role is gate/security related."""
        return role in cls.SECURITY_ROLES

    @classmethod
    def get_weight(cls, role: str) -> int:
        """Return the authority weight for a role (higher = more authority)."""
        return cls.ROLE_WEIGHTS.get(role, 0)

    @classmethod
    def can_manage(cls, actor_role: str, target_role: str) -> bool:
        """Return True if actor_role has authority to manage target_role."""
        return cls.get_weight(actor_role) > cls.get_weight(target_role)

    @classmethod
    def get_complaint_targets(cls, severity: str) -> list:
        """
        Return the list of role strings that should be notified/assigned
        when a complaint of this severity is created or escalated.
        """
        if severity in ('critical', 'high'):
            return cls.COMPLAINT_CRITICAL_TARGETS
        return cls.COMPLAINT_STANDARD_TARGETS


class AudienceTargets:
    """Target audience constants for communication modules."""
    HOSTELLERS = 'hostellers'
    DAY_SCHOLARS = 'day_scholars'
    ALL_STUDENTS = 'all_students'
    STAFF_ONLY = 'staff_only'
    SPECIFIC_DEPARTMENT = 'specific_department'
    SPECIFIC_YEAR = 'specific_year'
    
    CHOICES = [
        (HOSTELLERS, 'Hostellers'),
        (DAY_SCHOLARS, 'Day Scholars'),
        (ALL_STUDENTS, 'All Students'),
    ]

# Export for easy imports
STUDENT = UserRoles.STUDENT
MANAGEMENT_ROLES = UserRoles.MANAGEMENT_ROLES
ALL_STAFF_ROLES = UserRoles.ALL_STAFF_ROLES
BROADCAST_MANAGEMENT = UserRoles.BROADCAST_MANAGEMENT
BROADCAST_GATE_UPDATES = UserRoles.BROADCAST_GATE_UPDATES

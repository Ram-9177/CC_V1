"""Central RBAC engine.

Permission data is read from the database (apps.rbac tables) and cached per
user.  The static PERMISSION_MATRIX below acts as a **safe fallback** in
case the DB tables have not been seeded yet (e.g. during initial migrations).

Public API
----------
    has_module_permission(user, module, capability)  -> bool
    get_user_capabilities(user, module)              -> Set[str]
    get_path_grants_for_user(user)                   -> list[str]
"""

from __future__ import annotations

from typing import Dict, List, Set

from django.core.cache import cache

from core import cache_keys as ck
from core.constants import (
    ROLE_ADMIN,
    ROLE_CHEF,
    ROLE_DIRECTOR,
    ROLE_GATE_SECURITY,
    ROLE_HEAD_CHEF,
    ROLE_HEAD_WARDEN,
    ROLE_HOD,
    ROLE_INCHARGE,
    ROLE_PD,
    ROLE_PRINCIPAL,
    ROLE_PT,
    ROLE_SECURITY_HEAD,
    ROLE_STUDENT,
    ROLE_SUPER_ADMIN,
    ROLE_WARDEN,
    TOP_LEVEL_ROLES as TOP_LEVEL_ROLE_LIST,
)

MODULE_HOSTEL = 'hostel'
MODULE_SPORTS = 'sports'
MODULE_HALL = 'hall'
MODULE_FEES = 'fees'
MODULE_GATEPASS = 'gatepass'
MODULE_NOTICES = 'notices'
MODULE_MEALS = 'meals'
MODULE_SECURITY = 'security'
MODULE_REPORTS = 'reports'
MODULE_COMPLAINTS = 'complaints'
MODULE_NOTIFICATIONS = 'notifications'

ROLE_SECURITY = 'security'


ROLE_ALIASES = {
    ROLE_GATE_SECURITY: ROLE_SECURITY,
    ROLE_SECURITY_HEAD: ROLE_SECURITY,
}

TOP_LEVEL_ROLES = set(TOP_LEVEL_ROLE_LIST)
WARDEN_LEVEL_ROLES = TOP_LEVEL_ROLES | {ROLE_WARDEN}
GLOBAL_OWNER_ROLES = {ROLE_SUPER_ADMIN}
COLLEGE_OWNER_ROLES = {ROLE_ADMIN}

ROLE_GOVERNANCE_PROFILE: Dict[str, Dict[str, str]] = {
    ROLE_SUPER_ADMIN: {
        'scope': 'global',
        'label': 'Super Admin Owner',
        'description': 'Full product owner across all tenants/colleges.',
    },
    ROLE_ADMIN: {
        'scope': 'college',
        'label': 'College Admin Owner',
        'description': 'College-level owner with full control inside assigned college.',
    },
    ROLE_HEAD_WARDEN: {
        'scope': 'college_hostel',
        'label': 'Head Warden',
        'description': 'Head of warden operations and hostel governance within college.',
    },
    ROLE_WARDEN: {
        'scope': 'building_or_floor',
        'label': 'Warden',
        'description': 'Operational control for assigned blocks/floors under head-warden governance.',
    },
    ROLE_HEAD_CHEF: {
        'scope': 'college_kitchen',
        'label': 'Head Chef',
        'description': 'Leads kitchen/mess workflows and supervises chef operations.',
    },
    ROLE_CHEF: {
        'scope': 'kitchen_operations',
        'label': 'Chef',
        'description': 'Daily menu and meal operations under head-chef direction.',
    },
    ROLE_SECURITY_HEAD: {
        'scope': 'college_security',
        'label': 'Head Security',
        'description': 'Leads security operations and supervises gate-security workflows.',
    },
    ROLE_GATE_SECURITY: {
        'scope': 'security_execution',
        'label': 'Gate Security',
        'description': 'Executes scan/verification operations assigned by head security.',
    },
    ROLE_INCHARGE: {
        'scope': 'assigned_partial',
        'label': 'Incharge',
        'description': 'Limited assigned-scope support role without full management authority.',
    },
}


def _extract_role(role_or_user) -> str | None:
    """Accept either a role string or a user-like object."""
    if isinstance(role_or_user, str):
        return role_or_user
    return getattr(role_or_user, 'role', None)


def is_top_level_management(role_or_user) -> bool:
    """Backward-compatible top-level access check used by older modules."""
    role = _extract_role(role_or_user)
    return role in TOP_LEVEL_ROLES


def is_warden(role_or_user) -> bool:
    """Backward-compatible warden-or-higher access check used by older modules."""
    role = _extract_role(role_or_user)
    return role in WARDEN_LEVEL_ROLES


PERMISSION_MATRIX: Dict[str, Dict[str, str]] = {
    ROLE_SUPER_ADMIN: {
        MODULE_HOSTEL: 'full',
        MODULE_SPORTS: 'full',
        MODULE_HALL: 'full',
        MODULE_FEES: 'full',
        MODULE_GATEPASS: 'full',
        MODULE_NOTICES: 'full',
        MODULE_MEALS: 'full',
        MODULE_SECURITY: 'full',
        MODULE_REPORTS: 'full',
        MODULE_COMPLAINTS: 'full',
        MODULE_NOTIFICATIONS: 'full',
    },
    ROLE_ADMIN: {
        MODULE_HOSTEL: 'full',
        MODULE_SPORTS: 'full',
        MODULE_HALL: 'full',
        MODULE_FEES: 'full',
        MODULE_GATEPASS: 'full',
        MODULE_NOTICES: 'full',
        MODULE_MEALS: 'full',
        MODULE_SECURITY: 'full',
        MODULE_REPORTS: 'full',
        MODULE_COMPLAINTS: 'full',
        MODULE_NOTIFICATIONS: 'full',
    },
    ROLE_PRINCIPAL: {
        MODULE_HOSTEL: 'view',
        MODULE_SPORTS: 'view',
        MODULE_HALL: 'manage',
        MODULE_FEES: 'reports',
        MODULE_GATEPASS: 'view',
        MODULE_NOTICES: 'broadcast',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'view',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_DIRECTOR: {
        MODULE_HOSTEL: 'view',
        MODULE_SPORTS: 'view',
        MODULE_HALL: 'manage',
        MODULE_FEES: 'view',
        MODULE_GATEPASS: 'view',
        MODULE_NOTICES: 'broadcast',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'view',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_HOD: {
        MODULE_HOSTEL: 'none',
        MODULE_SPORTS: 'apply_for_class_branch',
        MODULE_HALL: 'request',
        MODULE_FEES: 'view',
        MODULE_GATEPASS: 'none',
        MODULE_NOTICES: 'department_notices',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_WARDEN: {
        MODULE_HOSTEL: 'manage',
        MODULE_SPORTS: 'none',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'approve',
        MODULE_NOTICES: 'hostel_notices',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'view',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'manage',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_INCHARGE: {
        MODULE_HOSTEL: 'view',
        MODULE_SPORTS: 'view',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'view',
        MODULE_NOTICES: 'create',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_PD: {
        MODULE_HOSTEL: 'none',
        MODULE_SPORTS: 'full_control',
        MODULE_HALL: 'manage',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'none',
        MODULE_NOTICES: 'sports_notices',
        MODULE_MEALS: 'none',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'none',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_PT: {
        MODULE_HOSTEL: 'none',
        MODULE_SPORTS: 'assist_verify',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'none',
        MODULE_NOTICES: 'none',
        MODULE_MEALS: 'none',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'none',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_SECURITY: {
        MODULE_HOSTEL: 'none',
        MODULE_SPORTS: 'none',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'verify_entry_exit',
        MODULE_NOTICES: 'none',
        MODULE_MEALS: 'none',
        MODULE_SECURITY: 'manage',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    ROLE_STUDENT: {
        MODULE_HOSTEL: 'limited',
        MODULE_SPORTS: 'participate',
        MODULE_HALL: 'none',
        MODULE_FEES: 'view',
        MODULE_GATEPASS: 'request',
        MODULE_NOTICES: 'view',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'none',
        MODULE_COMPLAINTS: 'create',
        MODULE_NOTIFICATIONS: 'view',
    },
    # HR role — scoped hostel/gatepass view, attendance management
    'hr': {
        MODULE_HOSTEL: 'manage',
        MODULE_SPORTS: 'none',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'approve',
        MODULE_NOTICES: 'hostel_notices',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'none',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'view',
        MODULE_NOTIFICATIONS: 'view',
    },
    # head_warden — same as warden but with metrics access (handled via ROLE_EXTRA_PATHS)
    'head_warden': {
        MODULE_HOSTEL: 'manage',
        MODULE_SPORTS: 'none',
        MODULE_HALL: 'none',
        MODULE_FEES: 'none',
        MODULE_GATEPASS: 'manage',
        MODULE_NOTICES: 'manage',
        MODULE_MEALS: 'view',
        MODULE_SECURITY: 'view',
        MODULE_REPORTS: 'view',
        MODULE_COMPLAINTS: 'manage',
        MODULE_NOTIFICATIONS: 'view',
    },
}


LEVEL_CAPABILITIES: Dict[str, Set[str]] = {
    'none':                   set(),
    'view':                   {'view'},
    'limited':                {'view', 'limited'},
    'reports':                {'view', 'reports'},
    'request':                {'view', 'request'},
    'participate':            {'view', 'participate'},
    'apply_for_class_branch': {'view', 'participate', 'apply'},
    'assist_verify':          {'view', 'verify'},
    'request_only':           {'request'},
    'partial':                {'view', 'partial'},
    'create':                 {'view', 'create'},
    'approve':                {'view', 'approve'},
    'verify_entry_exit':      {'view', 'verify'},
    'broadcast':              {'view', 'create', 'broadcast'},
    'department_notices':     {'view', 'create', 'department_scope'},
    'hostel_notices':         {'view', 'create', 'hostel_scope'},
    'sports_notices':         {'view', 'create', 'sports_scope'},
    'manage':     {'view', 'manage', 'create', 'update', 'delete', 'approve', 'verify', 'request'},
    'full_control': {'view', 'manage', 'create', 'update', 'delete', 'approve', 'verify', 'request'},
    'full': {'view', 'manage', 'create', 'update', 'delete', 'approve', 'verify',
             'request', 'reports', 'broadcast'},
}

# ---------------------------------------------------------------------------
# Path grants: module + permission-level → frontend routes
# ---------------------------------------------------------------------------

COMMON_PATHS: List[str] = [
    '/dashboard', '/profile', '/notifications', '/messages', '/notices',
    '/events', '/digital-id', '/fines', '/disciplinary', '/unauthorized',
]

MODULE_PATH_GRANTS: Dict[str, Dict[str, List[str]]] = {
    MODULE_HOSTEL: {
        'none':     [],
        # students use hostel self-service pages; backend queryset scoping keeps data private
        'limited':  ['/rooms', '/attendance', '/leaves', '/visitors'],
        # principals/directors read hostel overview via /reports — no /rooms
        'view':     [],
        'partial':  ['/rooms'],
        'manage':   ['/rooms', '/tenants', '/room-mapping', '/attendance', '/meals', '/complaints'],
        'full':     ['/rooms', '/tenants', '/room-mapping', '/attendance', '/meals', '/complaints'],
    },
    MODULE_SPORTS: {
        'none':                   [],
        'view':                   ['/events', '/sports-booking'],
        'participate':            ['/events', '/sports-booking'],
        'apply_for_class_branch': ['/events', '/sports-booking'],
        'partial':                ['/events', '/sports-booking', '/sports-dashboard'],
        'assist_verify':          ['/events', '/sports-booking', '/sports-dashboard'],
        'full_control':           ['/events', '/sports-booking', '/sports-dashboard'],
        'manage':                 ['/events', '/sports-booking', '/sports-dashboard'],
        'full':                   ['/events', '/sports-booking', '/sports-dashboard'],
    },
    MODULE_HALL: {
        'none':    [],
        'request': ['/hall-booking'],
        'manage':  ['/hall-booking'],
        'full':    ['/hall-booking'],
    },
    MODULE_FEES: {
        'none':    [],
        'limited': ['/fines'],
        'view':    ['/fines'],
        'reports': ['/fines'],
        'manage':  ['/fines'],
        'full':    ['/fines'],
    },
    MODULE_GATEPASS: {
        'none':               [],
        'view':               ['/gate-passes'],
        'request':            ['/gate-passes'],
        'partial':            ['/gate-passes'],
        # approve → wardens/HR can also manage leaves and see visitors
        'approve':            ['/gate-passes', '/gate-scans', '/leaves', '/visitors'],
        'verify_entry_exit':  ['/gate-passes', '/gate-scans', '/visitors'],
        'manage':             ['/gate-passes', '/gate-scans', '/visitors', '/leaves'],
        'full':               ['/gate-passes', '/gate-scans', '/visitors', '/leaves'],
    },
    MODULE_NOTICES: {
        'none':               [],
        'view':               ['/notices'],
        'create':             ['/notices'],
        'broadcast':          ['/notices'],
        'department_notices': ['/notices'],
        'hostel_notices':     ['/notices'],
        'sports_notices':     ['/notices'],
        'manage':             ['/notices'],
        'full':               ['/notices'],
    },
    MODULE_MEALS: {
        'none':    [],
        'view':    ['/meals'],
        'create':  ['/meals'],
        'manage':  ['/meals'],
        'full':    ['/meals'],
    },
    MODULE_SECURITY: {
        'none':               [],
        'view':               ['/gate-scans', '/visitors'],
        'verify_entry_exit':  ['/gate-scans', '/visitors'],
        'manage':             ['/gate-scans', '/visitors'],
        'full':               ['/gate-scans', '/visitors'],
    },
    MODULE_REPORTS: {
        'none':     [],
        'view':     ['/reports'],
        'reports':  ['/reports'],
        'manage':   ['/reports'],
        'full':     ['/reports'],
    },
    MODULE_COMPLAINTS: {
        'none':    [],
        'view':    ['/complaints'],
        'create':  ['/complaints'],
        'manage':  ['/complaints'],
        'full':    ['/complaints'],
    },
    MODULE_NOTIFICATIONS: {
        'none':    [],
        'view':    ['/notifications'],
        'create':  ['/notifications'],
        'manage':  ['/notifications'],
        'full':    ['/notifications'],
    },
}

# Paths not derivable from module permissions alone (role-specific extras)
ROLE_EXTRA_PATHS: Dict[str, List[str]] = {
    'super_admin':   ['/colleges', '/metrics', '/reports', '/users'],
    'admin':         ['/colleges', '/metrics', '/reports', '/users'],
    'head_warden':   ['/metrics', '/reports', '/meals'],
    'warden':        ['/metrics', '/reports', '/meals'],
    'principal':     ['/reports'],
    'director':      ['/reports'],
    'security_head': ['/reports', '/metrics'],
    'chef':          ['/meals', '/attendance', '/complaints'],
    'head_chef':     ['/meals', '/attendance', '/complaints'],
    'hr':            ['/reports', '/attendance'],
    'gate_security': ['/visitors'],
    'student':       ['/resume', '/placements', '/hall-booking'],
}

DAY_SCHOLAR_RESTRICTED_PATHS: List[str] = [
    '/rooms', '/meals', '/gate-passes', '/leaves', '/visitors', '/room-mapping',
]


def normalize_role(role: str | None) -> str:
    if not role:
        return ''
    role = role.lower()
    return ROLE_ALIASES.get(role, role)


def get_role_governance_profile(role_or_user) -> Dict[str, str]:
    """Return human-readable governance metadata for role clarity in clients."""
    role = normalize_role(_extract_role(role_or_user))
    return ROLE_GOVERNANCE_PROFILE.get(
        role,
        {
            'scope': 'standard',
            'label': role or 'unknown',
            'description': 'Standard role with module-level permissions from RBAC.',
        },
    )


def _permissions_cache_key(user_id: int) -> str:
    return ck.permissions_user(user_id)


def get_user_module_levels(user) -> Dict[str, str]:
    """Return {module_slug: permission_level_slug} for the user's role.

    Data source priority:
      1. In-process cache (Redis / local-mem)
      2. Database RolePermission table  (seeded via ``manage.py seed_rbac``)
      3. Static PERMISSION_MATRIX fallback (un-seeded / migration time)
    """
    if not getattr(user, 'is_authenticated', False):
        return {}

    cache_key = _permissions_cache_key(user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    role = normalize_role(getattr(user, 'role', None))

    # ── Try DB first ─────────────────────────────────────────────────────────
    try:
        from apps.rbac.models import RolePermission
        rows = (
            RolePermission.objects
            .filter(role__slug=role)
            .select_related('module', 'permission')
            .values('module__slug', 'permission__slug')
        )
        if rows.exists():
            role_matrix = {
                row['module__slug']: row['permission__slug']
                for row in rows
            }
            
            # --- DYNAMIC HR PERMISSIONS INJECTION ---
            if getattr(user, 'is_hr', False):
                try:
                    hr_perm = getattr(user, 'hr_permissions', None)
                    if hr_perm:
                        if getattr(hr_perm, 'can_view_attendance', False):
                            role_matrix[MODULE_HOSTEL] = 'view'
                        if getattr(hr_perm, 'can_view_complaints', False):
                            role_matrix[MODULE_COMPLAINTS] = 'view'
                        elif getattr(hr_perm, 'can_raise_complaints', True):
                            if role_matrix.get(MODULE_COMPLAINTS, 'none') == 'none':
                                role_matrix[MODULE_COMPLAINTS] = 'create'
                        if getattr(hr_perm, 'can_assist_reports', False):
                            role_matrix[MODULE_REPORTS] = 'view'
                        if getattr(hr_perm, 'can_manage_notices', False):
                            role_matrix[MODULE_NOTICES] = 'hostel_notices'
                        
                        # ENFORCEMENT: HR can NEVER override gate pass, fine, wardens
                        role_matrix[MODULE_GATEPASS] = 'request'  # Student tier, no approve
                        role_matrix[MODULE_FEES] = 'view'         # Fines view only, no issue
                except Exception:
                    pass
            # --- END DYNAMIC HR ---
            
            cache.set(cache_key, role_matrix, timeout=900)
            return role_matrix

    except Exception:
        pass  # DB not ready (makemigrations context) — fall through

    # ── Static fallback ──────────────────────────────────────────────────────
    role_matrix = PERMISSION_MATRIX.get(role, {})
    if role_matrix:
        import logging
        logging.getLogger(__name__).debug(
            "RBAC: using static PERMISSION_MATRIX fallback for role '%s' (user_id=%s). "
            "Run 'manage.py seed_rbac' to populate the DB.",
            role, getattr(user, 'id', '?'),
        )
    cache.set(cache_key, role_matrix, timeout=900)
    return role_matrix


def get_user_capabilities(user, module: str) -> Set[str]:
    levels = get_user_module_levels(user)
    level = levels.get(module, 'none')
    return LEVEL_CAPABILITIES.get(level, set())


def has_module_permission(user, module: str, capability: str) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False):
        return True

    capabilities = get_user_capabilities(user, module)
    if capability == 'view' and 'limited' in capabilities:
        return True

    return capability in capabilities or 'full' in capabilities or 'manage' in capabilities


# ---------------------------------------------------------------------------
# Path grant computation (used by /auth/my-permissions/ endpoint)
# ---------------------------------------------------------------------------

def get_path_grants_for_user(
    user,
    module_levels: Dict[str, str] | None = None,
) -> List[str]:
    """Return the sorted, deduplicated list of frontend route paths the user
    is allowed to visit.  Keys match the ``href`` values in Sidebar.tsx.
    """
    if module_levels is None:
        module_levels = get_user_module_levels(user)

    role = normalize_role(getattr(user, 'role', None))
    seen: set[str] = set()
    paths: List[str] = []

    def _add(p: str) -> None:
        if p not in seen:
            seen.add(p)
            paths.append(p)

    # 1. Common paths — always included
    for p in COMMON_PATHS:
        _add(p)

    # 2. Module-driven paths
    for module, level in module_levels.items():
        for p in MODULE_PATH_GRANTS.get(module, {}).get(level, []):
            _add(p)

    # 3. Role-specific extras not covered by modules
    for p in ROLE_EXTRA_PATHS.get(role, []):
        _add(p)

    if role == ROLE_STUDENT and getattr(user, 'is_student_hr', False):
        _add('/room-mapping')

    # 4. Day-scholar restrictions
    student_type = getattr(user, 'student_type', '')
    if role == ROLE_STUDENT and student_type == 'day_scholar':
        restricted_paths = set(DAY_SCHOLAR_RESTRICTED_PATHS)
        if getattr(user, 'is_student_hr', False):
            restricted_paths.discard('/room-mapping')
        paths = [p for p in paths if p not in restricted_paths]

    return sorted(set(paths))


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------

def clear_user_permission_cache(user_id: int) -> None:
    cache.delete(_permissions_cache_key(user_id))

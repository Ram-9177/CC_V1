"""
Centralised cache key factory for CampusCore.

All cache keys **must** be generated through this module to guarantee:
  1. Consistent namespacing:  ``hc:<app>:<feature>:<identifier>``
  2. Version isolation:       the ``CACHE_VERSION`` setting is baked in via
                              the KEY_PREFIX already set on the CACHES backend,
                              so individual keys only need an app-level prefix.
  3. Easy invalidation:       keys sharing a common prefix can be bulk-deleted
                              with ``cache.delete_pattern("hc:gatepass:list:*")``
                              (django-redis only).

Pattern reference
-----------------
  hc:auth:otp:password_reset:<user_id>
  hc:auth:otp:attempts:<hall_ticket>:<ip>
  hc:auth:otp:verify_attempts:<hall_ticket>:<ip>
  hc:gatepass:list:<user_id>
  hc:gatepass:forecast:debounce:<gate_pass_id>
  hc:student:bundle:<user_id>
  hc:metrics:dashboard:global
  hc:metrics:chef
  hc:meals:list
  hc:rooms:hostel_map_version
  hc:rooms:hostel_map
  hc:rooms:allocation:<user_id>
  hc:complaints:student_toggle
  hc:health:check
  hc:health:log_throttle
  hc:health:perf_probe
"""


# ---------------------------------------------------------------------------
# Auth / OTP
# ---------------------------------------------------------------------------

def otp_password_reset(user_id: int) -> str:
    """Stored hashed OTP for password reset flow."""
    return f"hc:auth:otp:password_reset:{user_id}"


def otp_request_attempts(hall_ticket: str, client_ip: str) -> str:
    """Rate-limit counter for OTP request attempts per user+IP."""
    return f"hc:auth:otp:attempts:{hall_ticket}:{client_ip}"


def otp_verify_attempts(hall_ticket: str, client_ip: str) -> str:
    """Rate-limit counter for OTP verify attempts per user+IP."""
    return f"hc:auth:otp:verify_attempts:{hall_ticket}:{client_ip}"


# ---------------------------------------------------------------------------
# Gate Pass
# ---------------------------------------------------------------------------

def gatepass_list_prefix(user_id: int) -> str:
    """Prefix for all list-view cache keys belonging to a user."""
    return f"hc:gatepass:list:{user_id}"


def gatepass_list(user_id: int, params_fingerprint: str) -> str:
    """Full cache key for a specific filtered gate pass list page."""
    return f"hc:gatepass:list:{user_id}:{params_fingerprint}"


def gatepass_forecast_debounce(gate_pass_id: int) -> str:
    """Short-lived debounce flag to prevent repeated chef forecast broadcasts."""
    return f"hc:gatepass:forecast:debounce:{gate_pass_id}"


# ---------------------------------------------------------------------------
# Student bundle
# ---------------------------------------------------------------------------

def student_bundle(user_id: int) -> str:
    """Cached student bundle metrics (room, passes, attendance summary)."""
    return f"hc:student:bundle:{user_id}"


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def metrics_dashboard_global() -> str:
    return "hc:metrics:dashboard:global"


def metrics_chef() -> str:
    return "hc:metrics:chef"


# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------

def meals_list_prefix() -> str:
    return "hc:meals:list"


# ---------------------------------------------------------------------------
# Rooms / Hostel map
# ---------------------------------------------------------------------------

def rooms_hostel_map_version() -> str:
    return "hc:rooms:hostel_map_version"


def rooms_hostel_map() -> str:
    return "hc:rooms:hostel_map"


def rooms_allocation(user_id: int) -> str:
    return f"hc:rooms:allocation:{user_id}"


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------

def complaints_student_toggle() -> str:
    return "hc:complaints:student_toggle"


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def health_check() -> str:
    return "hc:health:check"


def health_log_throttle() -> str:
    return "hc:health:log_throttle"


def health_perf_probe() -> str:
    return "hc:health:perf_probe"


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

def permissions_user(user_id: int) -> str:
    """Cached RBAC module matrix for a user."""
    return f"hc:rbac:permissions:{user_id}"

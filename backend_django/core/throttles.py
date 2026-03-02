"""
Custom throttle classes for API rate limiting.

PRODUCTION-SAFE: Settings-driven — all rates come from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
No class-level rate overrides. Single source of truth in settings.py.
"""

from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    """
    Strict rate limit for login attempts.
    Prevents brute-force attacks.
    Rate: Defined by 'login' scope in settings.
    """
    scope = 'login'


class ExportRateThrottle(ScopedRateThrottle):
    """
    Conservative limit for CSV/PDF exports.
    Expensive operations: database queries + file generation.
    Rate: Defined by 'export' scope in settings.
    """
    scope = 'export'


class BulkOperationThrottle(ScopedRateThrottle):
    """
    Limit for bulk operations (batch create, bulk delete, mark-all).
    Rate: Defined by 'bulk_operation' scope in settings.
    """
    scope = 'bulk_operation'


class PasswordChangeThrottle(ScopedRateThrottle):
    """
    Rate limit for password change/reset attempts.
    Rate: Defined by 'password_change' scope in settings.
    """
    scope = 'password_change'


class RoleChangeThrottle(ScopedRateThrottle):
    """
    Rate limit for role changes and user activation/deactivation.
    Critical security action — strict limit.
    Rate: Defined by 'role_change' scope in settings.
    """
    scope = 'role_change'


class NotificationBulkThrottle(ScopedRateThrottle):
    """
    Rate limit for mark-all-as-read and similar bulk notification ops.
    Rate: Defined by 'notification_bulk' scope in settings.
    """
    scope = 'notification_bulk'

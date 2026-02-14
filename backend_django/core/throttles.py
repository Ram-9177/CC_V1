"""
Custom throttle classes for API rate limiting.

PRODUCTION-SAFE: Optimized for free-tier hosting with sensible limits.
"""

from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class LoginRateThrottle(UserRateThrottle):
    """
    Strict rate limit for login attempts.
    
    Prevents brute-force attacks.
    Free tier safe: Low request count.
    """
    scope = 'login_scope'
    rate = '100/minute'


class ExportRateThrottle(UserRateThrottle):
    """
    Conservative limit for CSV/PDF exports.
    
    Expensive operations: database queries + file generation.
    Prevents free-tier quota exhaustion.
    """
    scope = 'export_scope'
    rate = '2/minute'


class BulkOperationThrottle(UserRateThrottle):
    """
    Limit for bulk operations (batch create, bulk delete).
    
    FIX #4: Increased from 5/min to 15/min for real-world usability.
    During hostel admission, wardens need to allocate many students quickly.
    Prevents database hammering on free tier while staying practical.
    """
    scope = 'bulk_scope'
    rate = '15/minute'

class PasswordChangeThrottle(UserRateThrottle):
    """
    Rate limit for password change attempts.
    """
    scope = 'password_change'
    rate = '10/minute'


class AnonymousStrictThrottle(AnonRateThrottle):
    """
    Very strict for unauthenticated requests.
    
    Most endpoints require auth, but public ones need protection.
    """
    scope = 'anon'
    rate = '10/minute'

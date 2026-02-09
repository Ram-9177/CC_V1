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
    rate = '5/minute'


class ExportRateThrottle(UserRateThrottle):
    """
    Conservative limit for CSV/PDF exports.
    
    Expensive operations: database queries + file generation.
    Prevents free-tier quota exhaustion.
    """
    rate = '2/minute'


class BulkOperationThrottle(UserRateThrottle):
    """
    Limit for bulk operations (batch create, bulk delete).
    
    Prevents database hammering on free tier.
    """
    rate = '5/minute'


class AnonymousStrictThrottle(AnonRateThrottle):
    """
    Very strict for unauthenticated requests.
    
    Most endpoints require auth, but public ones need protection.
    """
    rate = '10/minute'

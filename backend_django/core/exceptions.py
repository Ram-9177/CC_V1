"""Legacy exception compatibility layer.

This module historically defined a parallel error system. The canonical source
is now `core.errors`. Keep imports stable here to avoid breaking existing code.
"""

from rest_framework.exceptions import APIException

from core.errors import (  # Canonical exports
    PermissionAPIError,
    ValidationAPIError,
    standardized_exception_handler,
)


class InvalidTransitionError(APIException):
    status_code = 400
    default_detail = 'This state transition is not allowed.'
    default_code = 'INVALID_TRANSITION'


def custom_exception_handler(exc, context):
    """Backward-compatible alias for the unified exception handler."""
    return standardized_exception_handler(exc, context)


__all__ = [
    'InvalidTransitionError',
    'PermissionAPIError',
    'ValidationAPIError',
    'custom_exception_handler',
]

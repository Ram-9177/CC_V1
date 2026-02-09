"""Custom exception handlers for DRF."""

from rest_framework.response import Response
from rest_framework.views import exception_handler
from rest_framework import status
import logging

logger = logging.getLogger('django.request')


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    
    SAFETY: Catches ALL exceptions (including 500 errors) and returns
    sanitized error responses. Never exposes stack traces or sensitive data.
    """
    # Call REST framework's default handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Handle known DRF exceptions (400, 403, 404, etc.)
        if response.status_code == status.HTTP_403_FORBIDDEN:
            response.data = {
                'detail': 'You do not have permission to perform this action.',
                'error_code': 'PERMISSION_DENIED',
            }
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            response.data = {
                'detail': 'Resource not found.',
                'error_code': 'NOT_FOUND',
            }
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            # Preserve validation errors
            response.data = {
                'detail': response.data if isinstance(response.data, dict) else str(response.data),
                'error_code': 'BAD_REQUEST',
            }
    else:
        # Handle UNEXPECTED exceptions (500 errors)
        # This is CRITICAL - prevents stack trace exposure
        logger.error(
            f"Unhandled exception: {exc}",
            exc_info=True,
            extra={
                'context': context,
                'exception_type': type(exc).__name__,
            }
        )
        
        response = Response(
            {
                'detail': 'An unexpected error occurred. Please try again or contact support.',
                'error_code': 'INTERNAL_SERVER_ERROR',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response

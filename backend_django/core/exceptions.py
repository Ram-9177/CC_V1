"""Custom exception handlers for DRF."""

from rest_framework.response import Response
from rest_framework.views import exception_handler
from rest_framework import status
import logging
import uuid

logger = logging.getLogger('django.request')


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    
    SAFETY: Catches ALL exceptions (including 500 errors) and returns
    sanitized error responses. Never exposes stack traces or sensitive data.
    
    FIX #6: Adds unique error_id for support debugging.
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
                'error_code': 'NOT FOUND',
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
        
        # FIX #6: Generate unique error ID for support
        error_id = uuid.uuid4().hex[:8].upper()
        
        logger.error(
            f"[ERROR-{error_id}] Unhandled exception: {exc}",
            exc_info=True,
            extra={
                'error_id': error_id,
                'context': context,
                'exception_type': type(exc).__name__,
            }
        )
        
        response = Response(
            {
                'detail': 'An unexpected error occurred. Please contact support with this error ID.',
                'error_code': 'INTERNAL_SERVER_ERROR',
                'error_id': error_id,  # User can provide this to support
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response

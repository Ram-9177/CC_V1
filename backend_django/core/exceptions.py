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
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize DRF error format
        if not isinstance(response.data, dict):
             response.data = {'detail': response.data}
        
        # Add error code if missing
        if 'error_code' not in response.data:
            if response.status_code == 403:
                response.data['error_code'] = 'PERMISSION_DENIED'
            elif response.status_code == 404:
                response.data['error_code'] = 'NOT_FOUND'
            elif response.status_code == 401:
                response.data['error_code'] = 'AUTHENTICATION_FAILED'
            elif response.status_code == 429:
                response.data['error_code'] = 'THROTTLED'
            else:
                response.data['error_code'] = 'VALIDATION_ERROR'

    else:
        # Handle 500 Server Errors (Non-DRF exceptions)
        error_id = uuid.uuid4().hex[:8].upper()
        
        logger.error(
            f"[ERROR-{error_id}] Unhandled exception: {str(exc)}",
            exc_info=True,
            extra={
                'error_id': error_id,
                'path': context['request'].path if 'request' in context else 'unknown'
            }
        )
        
        # Return structured JSON — never re-raise the raw exception (would leak stack traces)
        response = Response(
            {
                'detail': 'An unexpected error occurred. Please contact support.',
                'error_code': 'INTERNAL_SERVER_ERROR',
                'error_id': error_id
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response

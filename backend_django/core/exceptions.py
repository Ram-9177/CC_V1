"""Custom exception handlers for DRF."""

from rest_framework.response import Response
from rest_framework.views import exception_handler
from rest_framework import status


def custom_exception_handler(exc, context):
    """Custom exception handler for DRF."""
    response = exception_handler(exc, context)
    
    if response is not None:
        if response.status_code == status.HTTP_403_FORBIDDEN:
            response.data = {
                'detail': 'You do not have permission to perform this action.',
                'error_code': 'PERMISSION_DENIED',
            }
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            response.data = {
                'detail': 'Not found.',
                'error_code': 'NOT_FOUND',
            }
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            response.data = {
                'detail': response.data,
                'error_code': 'BAD_REQUEST',
            }
    
    return response

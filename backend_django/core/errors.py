"""Standardized API error handling and responses."""

import logging
import traceback
from typing import Any, Dict, Optional
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError, PermissionDenied
from django.http import JsonResponse

logger = logging.getLogger(__name__)


from rest_framework.exceptions import APIException

class APIError(APIException):
    """Base API error that integrates with DRF's exception handling."""
    def __init__(self, message: str, code: str = "API_ERROR", status_code: int = 400, details: Optional[Dict] = None):
        self.status_code = status_code
        self.message = message
        self.code = code
        self.details = details or {}
        # DRF uses 'detail' attribute for the response data
        self.detail = {
            'success': False,
            'error_code': code,
            'message': message,
            'details': details or {}
        }
        super().__init__(detail=self.detail) # type: ignore


class ValidationAPIError(APIError):
    """Validation error."""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(message, "VALIDATION_ERROR", 400, details)


class PermissionAPIError(APIError):
    """Permission denied error."""
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message, "PERMISSION_DENIED", 403)


class NotFoundAPIError(APIError):
    """Resource not found error."""
    def __init__(self, message: str = "Resource not found", resource_type: str = ""):
        super().__init__(
            message if message != "Resource not found" else f"{resource_type} not found",
            "NOT_FOUND",
            404
        )


class ConflictAPIError(APIError):
    """Resource conflict error."""
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, "CONFLICT", 409)


def format_validation_error(error: ValidationError) -> Dict[str, Any]:
    """Convert Django ValidationError to API error format."""
    if hasattr(error, 'error_dict'):
        # Field-specific errors
        return {field: [str(e) for e in errors] for field, errors in error.error_dict.items()}
    elif hasattr(error, 'error_list'):
        # Non-field errors
        return {'non_field_errors': [str(e) for e in error.error_list]}
    else:
        return {'detail': str(error)}


def standardized_exception_handler(exc: Exception, context: Dict) -> Optional[Response]:
    """
    Custom exception handler for consistent API error responses.
    
    All errors return:
    {
        "success": false,
        "code": "ERROR_CODE",
        "message": "User-friendly message",
        "details": {...additional context...}
    }
    """
    
    # Log exception
    request = context.get('request')
    view = context.get('view')
    
    logger.warning(
        f"API Error: {exc.__class__.__name__}",
        extra={
            'path': request.path if request else None,
            'method': request.method if request else None,
            'user': request.user.id if request and request.user else None,
            'exception': str(exc),
        }
    )
    
    # Handle custom API errors
    if isinstance(exc, APIError):
        return Response(
            {
                'success': False,
                'code': exc.code,
                'message': exc.message,
                'details': exc.details,
            },
            status=exc.status_code
        )
    
    # Handle DRF exceptions
    response = exception_handler(exc, context)
    if response is not None:
        return Response(
            {
                'success': False,
                'code': 'API_ERROR',
                'message': str(response.data.get('detail', 'An error occurred')),
                'details': response.data if len(response.data) > 1 else {},
            },
            status=response.status_code
        )
    
    # Handle Django ValidationError
    if isinstance(exc, ValidationError):
        return Response(
            {
                'success': False,
                'code': 'VALIDATION_ERROR',
                'message': 'Validation failed',
                'details': format_validation_error(exc),
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Handle PermissionDenied
    if isinstance(exc, PermissionDenied):
        return Response(
            {
                'success': False,
                'code': 'PERMISSION_DENIED',
                'message': str(exc) or 'You do not have permission to perform this action',
                'details': {},
            },
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Handle unexpected errors
    logger.error(
        f"Unhandled exception: {exc.__class__.__name__}",
        exc_info=True,
        extra={'path': request.path if request else None}
    )
    
    # Don't leak internal errors in production
    return Response(
        {
            'success': False,
            'code': 'INTERNAL_ERROR',
            'message': 'An internal error occurred. Please try again later.',
            'details': {},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def api_error_response(message: str, code: str = "ERROR", details: Optional[Dict] = None,
                       status_code: int = 400) -> Response:
    """
    Helper to create consistent error responses.
    
    Usage:
        return api_error_response("Invalid input", "VALIDATION_ERROR", {"field": "error"})
    """
    return Response(
        {
            'success': False,
            'code': code,
            'message': message,
            'details': details or {},
        },
        status=status_code
    )


def api_success_response(data: Any = None, message: str = "Success", code: str = "SUCCESS",
                         status_code: int = 200) -> Response:
    """
    Helper to create consistent success responses.
    
    Usage:
        return api_success_response(data=gate_pass, message="Gate pass created")
    """
    return Response(
        {
            'success': True,
            'code': code,
            'message': message,
            'data': data,
        },
        status=status_code
    )

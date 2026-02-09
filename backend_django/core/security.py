"""Security utilities and validators."""

import re
import logging
from typing import Any, Dict, List, Optional
from django.core.exceptions import ValidationError
from django.utils.html import escape

logger = logging.getLogger(__name__)


class InputValidator:
    """Centralized input validation for all API endpoints."""
    
    # Maximum lengths to prevent abuse
    MAX_CHAR_FIELD = 500
    MAX_TEXT_FIELD = 5000
    MAX_EMAIL = 254
    MAX_PHONE = 20
    
    # Patterns for validation
    PHONE_PATTERN = r'^[\d\-\+\(\)\s]{7,20}$'
    TICKET_PATTERN = r'^[a-zA-Z0-9\-]{3,50}$'
    
    @staticmethod
    def validate_string(value: Any, field_name: str, max_length: int = MAX_CHAR_FIELD) -> str:
        """Validate string input."""
        if not isinstance(value, str):
            raise ValidationError(f"{field_name} must be a string.")
        
        if len(value) > max_length:
            raise ValidationError(f"{field_name} exceeds maximum length of {max_length}.")
        
        return value.strip()
    
    @staticmethod
    def validate_email(email: str) -> str:
        """Validate email format."""
        if not email or len(email) > InputValidator.MAX_EMAIL:
            raise ValidationError("Invalid email format.")
        
        # Simple email validation
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            raise ValidationError("Invalid email format.")
        
        return email.lower()
    
    @staticmethod
    def validate_phone(phone: str) -> str:
        """Validate phone number."""
        phone = InputValidator.validate_string(phone, "Phone", InputValidator.MAX_PHONE)
        
        if not re.match(InputValidator.PHONE_PATTERN, phone):
            raise ValidationError("Invalid phone number format.")
        
        return phone
    
    @staticmethod
    def validate_hall_ticket(ticket: str) -> str:
        """Validate hall ticket number."""
        ticket = InputValidator.validate_string(ticket, "Hall Ticket", 50)
        
        if not re.match(InputValidator.TICKET_PATTERN, ticket):
            raise ValidationError("Invalid hall ticket format.")
        
        return ticket
    
    @staticmethod
    def validate_date_format(date_str: str) -> str:
        """Validate date is in ISO format."""
        if not isinstance(date_str, str):
            raise ValidationError("Date must be a string.")
        
        # Basic ISO format validation (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
        pattern = r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?'
        if not re.match(pattern, date_str):
            raise ValidationError("Invalid date format. Use ISO format (YYYY-MM-DD).")
        
        return date_str
    
    @staticmethod
    def sanitize_html(text: str) -> str:
        """Escape HTML to prevent XSS."""
        return escape(text)
    
    @staticmethod
    def validate_status(status: str, allowed_statuses: List[str]) -> str:
        """Validate status is in allowed list."""
        status = InputValidator.validate_string(status, "Status", 50)
        
        if status not in allowed_statuses:
            raise ValidationError(
                f"Invalid status '{status}'. Allowed: {', '.join(allowed_statuses)}"
            )
        
        return status


class PermissionValidator:
    """Validate user permissions and ownership."""
    
    @staticmethod
    def validate_ownership(user_id: int, owner_id: int, user_role: str, allowed_roles: List[str]) -> bool:
        """
        Check if user owns object or has sufficient role.
        
        Args:
            user_id: ID of requesting user
            owner_id: ID of resource owner
            user_role: Role of requesting user
            allowed_roles: Roles that can access any resource
        
        Returns:
            True if user has access
        """
        # Admin roles can access anything
        if user_role in allowed_roles:
            return True
        
        # User must own the resource
        return user_id == owner_id
    
    @staticmethod
    def validate_resource_access(user, resource, required_role: Optional[str] = None) -> bool:
        """
        Validate user can access resource.
        
        Args:
            user: Requesting user
            resource: Resource object with optional student_id, user_id, or owner_id
            required_role: Minimum role required
        
        Returns:
            True if user can access resource
        """
        from core.permissions import ADMIN_ROLES, AUTHORITY_ROLES, SECURITY_ROLES
        
        if not user or not user.is_authenticated:
            return False
        
        # Superusers always have full access
        if user.is_superuser:
            return True
        
        # Check role requirement
        if required_role:
            if required_role == 'admin' and user.role not in ADMIN_ROLES:
                return False
            elif required_role == 'staff' and user.role not in AUTHORITY_ROLES:
                return False
            elif required_role == 'security' and user.role not in SECURITY_ROLES:
                return False
        
        # Admin roles have access
        if user.role in ADMIN_ROLES:
            return True
        
        # Check ownership
        if hasattr(resource, 'student_id'):
            return resource.student_id == user.id
        elif hasattr(resource, 'user_id'):
            return resource.user_id == user.id
        elif hasattr(resource, 'owner_id'):
            return resource.owner_id == user.id
        
        return False


class RateLimiter:
    """Simple rate limiting for API endpoints."""
    
    _request_counts: Dict[str, List[float]] = {}
    
    @staticmethod
    def is_rate_limited(identifier: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
        """
        Check if identifier has exceeded rate limit.
        
        Args:
            identifier: User ID or IP address
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
        
        Returns:
            True if rate limited
        """
        import time
        
        now = time.time()
        cutoff = now - window_seconds
        
        if identifier not in RateLimiter._request_counts:
            RateLimiter._request_counts[identifier] = []
        
        # Remove old requests outside window
        RateLimiter._request_counts[identifier] = [
            req_time for req_time in RateLimiter._request_counts[identifier]
            if req_time > cutoff
        ]
        
        # Check if limit exceeded
        if len(RateLimiter._request_counts[identifier]) >= max_requests:
            return True
        
        # Add current request
        RateLimiter._request_counts[identifier].append(now)
        return False


class AuditLogger:
    """Log all important actions for security audit trail."""
    
    _logger = logging.getLogger('audit')
    
    @staticmethod
    def log_action(user_id: int, action: str, resource_type: str, resource_id: int, 
                   details: Optional[Dict] = None, success: bool = True) -> None:
        """
        Log an action for audit purposes.
        
        Args:
            user_id: ID of user performing action
            action: Action type (create, update, delete, approve, reject, etc.)
            resource_type: Type of resource (gate_pass, room, meal, etc.)
            resource_id: ID of affected resource
            details: Additional details about action
            success: Whether action succeeded
        """
        log_entry = {
            'user_id': user_id,
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'success': success,
        }
        
        if details:
            log_entry['details'] = details
        
        level = 'INFO' if success else 'WARNING'
        AuditLogger._logger.log(
            logging.INFO if success else logging.WARNING,
            f"AUDIT: {action.upper()} {resource_type}#{resource_id} by user#{user_id} - {details or ''}"
        )


def safe_getattr(obj: Any, attr: str, default: Any = None) -> Any:
    """Safely get attribute without triggering property errors."""
    try:
        return getattr(obj, attr, default)
    except Exception as e:
        logger.warning(f"Error accessing {attr}: {str(e)}")
        return default

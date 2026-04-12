"""
PHASE 12: EXECUTION + STABILITY
Centralized Transaction & Error Governance Runner.
"""
import logging
from typing import Callable, Any
from django.db import transaction
from rest_framework.exceptions import APIException
from core.exceptions import InvalidTransitionError

logger = logging.getLogger(__name__)

def execute_with_safety(action_name: str, atomic: bool = True):
    """
    Decorator to wrap critical business operations in a safe execution environment.
    Guarantees:
      1. Transaction atomicity (preventing partial data corruption).
      2. Uniform Error Logging (global error handling without 500 crashes).
      
    Usage:
        @execute_with_safety("Approve Gatepass")
        def approve_student_gatepass(gp_id, warden):
            ...
    """
    def decorator(func: Callable) -> Callable:
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                if atomic:
                    with transaction.atomic():
                        return func(*args, **kwargs)
                return func(*args, **kwargs)
            except (APIException, InvalidTransitionError) as e:
                # Let client errors (400) bubble up naturally
                logger.warning(f"Business rule validation failed during '{action_name}': {str(e)}")
                raise
            except Exception as e:
                # Catch unforeseen 500 crash threats before they break the server loop
                logger.error(
                    f"CRITICAL FAILURE during '{action_name}': {str(e)}", 
                    exc_info=True
                )
                # Re-raise as a generic API Exception to return safe JSON (from global handler)
                raise APIException(f"Action '{action_name}' failed to process completely.") from e
        return wrapper
    return decorator

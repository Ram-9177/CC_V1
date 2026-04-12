"""
PHASE 12: EXECUTION + STABILITY
Centralized Retry Mechanisms for Background Processing & Integrations.
"""
import logging
import time
from functools import wraps
from typing import Callable, Any

logger = logging.getLogger(__name__)

def safe_retry(max_retries: int = 3, backoff_seconds: int = 2, exceptions: tuple = (Exception,)):
    """
    Decorator to safely retry critical failing operations.
    Prevents background processing crashes from temporary blips (e.g. DB locks, 3rd party API drops).
    
    Usage:
        @safe_retry(max_retries=3, exceptions=(ConnectionError,))
        def process_bulk_upload_batch():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempts = 0
            while attempts < max_retries:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    attempts += 1
                    if attempts == max_retries:
                        logger.error(
                            f"Action {func.__name__} failed permanently after {max_retries} retries. Error: {str(e)}", 
                            exc_info=True
                        )
                        raise  # Final bubble up for Celery handling
                    
                    delay = backoff_seconds * attempts # Exponential backoff approach
                    logger.warning(
                        f"Action {func.__name__} failed (Attempt {attempts}/{max_retries}). Retrying in {delay}s. Error: {str(e)}"
                    )
                    time.sleep(delay)
                    
        return wrapper
    return decorator

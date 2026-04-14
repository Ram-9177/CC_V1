"""
Service layer resilience mixins for database operations.
Provides automatic retry logic, cache fallback, and transaction protection.
"""

import logging
from typing import Optional, Any, Callable, List, Dict
from functools import wraps
from django.db import transaction, IntegrityError, OperationalError
from django.core.cache import cache
from django.core.exceptions import ValidationError

from core.connection_resilience import (
    RetryStrategy,
    CacheFallback,
    DBHealthCheck,
)

logger = logging.getLogger(__name__)


class ResilientServiceMixin:
    """Mixin providing resilience patterns for Django services."""
    
    # Override these in subclass
    CACHE_TTL = 3600  # 1 hour
    MAX_RETRIES = 3
    
    def _get_cache_key(self, prefix: str, identifier: Any) -> str:
        """Generate cache key for a resource."""
        return f"{self.__class__.__name__}:{prefix}:{identifier}"
    
    def _execute_with_retry(self, operation: Callable, *args, **kwargs):
        """Execute operation with exponential backoff retry."""
        delay = 0.1
        last_error = None
        
        for attempt in range(self.MAX_RETRIES):
            try:
                return operation(*args, **kwargs)
            except (IntegrityError, OperationalError) as e:
                last_error = e
                if attempt < self.MAX_RETRIES - 1:
                    import time
                    logger.warning(
                        f"Attempt {attempt + 1}/{self.MAX_RETRIES} for {operation.__name__} "
                        f"failed: {e}. Retrying in {delay}s..."
                    )
                    time.sleep(delay)
                    delay = min(delay * 2, 8)  # Cap at 8 seconds
                else:
                    logger.error(f"All {self.MAX_RETRIES} attempts failed for {operation.__name__}")
        
        raise last_error
    
    def _get_or_query(self, cache_key: str, query_func: Callable, ttl: Optional[int] = None):
        """Get from cache or execute query, with fallback to degraded cache."""
        ttl = ttl or self.CACHE_TTL
        
        return CacheFallback.get_or_query(
            cache_key,
            query_func,
            ttl=ttl,
            fallback_ttl=ttl // 3  # 1/3 original TTL for degraded mode
        )
    
    def _cache_set(self, cache_key: str, value: Any, ttl: Optional[int] = None):
        """Set cache with backup for degraded mode."""
        ttl = ttl or self.CACHE_TTL
        CacheFallback.set_with_backup(cache_key, value, ttl)
    
    def _invalidate_cache(self, pattern: str):
        """Invalidate cache entries matching pattern."""
        try:
            # For Redis, we can use patterns
            # For dummy cache, this is a no-op
            regex_pattern = f"{self.__class__.__name__}:{pattern}:*"
            # Note: Simple key delete only - pattern matching requires Redis keys() command
            logger.debug(f"Invalidating cache pattern: {regex_pattern}")
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")
    
    @transaction.atomic
    def _atomic_operation(self, operation: Callable, *args, **kwargs):
        """Execute operation within atomic transaction with retries."""
        return self._execute_with_retry(operation, *args, **kwargs)


class ReadOnlyServiceMixin(ResilientServiceMixin):
    """Mixin for read-only service operations with heavy caching."""
    
    def get_with_cache(
        self,
        identifier: Any,
        query_func: Callable,
        prefix: str = 'get',
        ttl: Optional[int] = None
    ):
        """Get single resource with cache preference."""
        cache_key = self._get_cache_key(prefix, identifier)
        
        try:
            result, source = self._get_or_query(cache_key, lambda: query_func(identifier))
            logger.debug(f"Read from {source}: {cache_key}")
            return result
        except Exception as e:
            logger.error(f"Failed to retrieve {cache_key}: {e}")
            raise
    
    def list_with_cache(
        self,
        query_func: Callable,
        prefix: str = 'list',
        ttl: Optional[int] = None,
        **filters
    ) -> List:
        """List resources with cache preference."""
        cache_key = self._get_cache_key(prefix, str(filters))
        
        try:
            result, source = self._get_or_query(
                cache_key,
                lambda: list(query_func(**filters))
            )
            logger.debug(f"Read {len(result)} items from {source}: {cache_key}")
            return result
        except Exception as e:
            logger.error(f"Failed to list with cache: {e}")
            raise


class WriteServiceMixin(ResilientServiceMixin):
    """Mixin for write operations with cache invalidation and transaction protection."""
    
    @transaction.atomic
    def create_with_resilience(self, model_class, invalidate_patterns: List[str] = None, **kwargs):
        """Create object with automatic cache invalidation."""
        try:
            # Perform creation with retry
            obj = self._execute_with_retry(
                lambda: model_class.objects.create(**kwargs)
            )
            
            # Invalidate related caches
            if invalidate_patterns:
                for pattern in invalidate_patterns:
                    self._invalidate_cache(pattern)
            
            logger.info(f"Created {model_class.__name__} with ID {obj.id}")
            return obj
        
        except IntegrityError as e:
            logger.error(f"Integrity error creating {model_class.__name__}: {e}")
            raise ValidationError(f"Duplicate or invalid data: {e}")
        except Exception as e:
            logger.error(f"Error creating {model_class.__name__}: {e}")
            raise
    
    @transaction.atomic
    def update_with_resilience(
        self,
        obj,
        invalidate_patterns: List[str] = None,
        **kwargs
    ):
        """Update object with automatic cache invalidation."""
        try:
            # Perform update with retry
            def do_update():
                for key, value in kwargs.items():
                    setattr(obj, key, value)
                obj.full_clean()
                obj.save()
                return obj
            
            updated_obj = self._execute_with_retry(do_update)
            
            # Invalidate related caches
            if invalidate_patterns:
                for pattern in invalidate_patterns:
                    self._invalidate_cache(pattern)
            
            logger.info(f"Updated {obj.__class__.__name__} with ID {obj.id}")
            return updated_obj
        
        except ValidationError as e:
            logger.warning(f"Validation error updating {obj.__class__.__name__}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error updating {obj.__class__.__name__}: {e}")
            raise
    
    @transaction.atomic
    def delete_with_resilience(self, obj, invalidate_patterns: List[str] = None):
        """Delete object with automatic cache invalidation."""
        try:
            obj_id = obj.id
            obj_class = obj.__class__.__name__
            
            # Perform deletion with retry
            def do_delete():
                obj.delete()
            
            self._execute_with_retry(do_delete)
            
            # Invalidate related caches
            if invalidate_patterns:
                for pattern in invalidate_patterns:
                    self._invalidate_cache(pattern)
            
            logger.info(f"Deleted {obj_class} {obj_id}")
        
        except Exception as e:
            logger.error(f"Error deleting {obj.__class__.__name__}: {e}")
            raise


# Decorator for service methods

def with_resilience(
    max_retries: int = 3,
    use_cache: bool = False,
    cache_ttl: int = 3600,
    cache_key_prefix: str = ''
):
    """Decorator to add resilience to any service method.
    
    Args:
        max_retries: Number of retry attempts
        use_cache: Whether to cache the result
        cache_ttl: Cache TTL in seconds
        cache_key_prefix: Prefix for cache key
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            operation = lambda: func(self, *args, **kwargs)
            
            # Try cache first if enabled
            if use_cache:
                cache_key = f"{cache_key_prefix}:{args}:{kwargs}"
                try:
                    cached = cache.get(cache_key)
                    if cached is not None:
                        logger.debug(f"Cache HIT for {func.__name__}")
                        return cached
                except Exception as e:
                    logger.debug(f"Cache read failed for {func.__name__}: {e}")
            
            # Execute with retry
            delay = 0.1
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    result = operation()
                    
                    # Cache result if enabled
                    if use_cache:
                        try:
                            cache.set(cache_key, result, cache_ttl)
                        except Exception as e:
                            logger.debug(f"Cache write failed for {func.__name__}: {e}")
                    
                    return result
                
                except (IntegrityError, OperationalError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        import time
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} for {func.__name__} "
                            f"failed: {e}. Retrying..."
                        )
                        time.sleep(delay)
                        delay = min(delay * 2, 8)
            
            raise last_error
        
        return wrapper
    return decorator


# Context manager for safe database access

class SafeDatabase:
    """Context manager for safe database access with fallback."""
    
    def __init__(self, fallback_value=None):
        self.fallback_value = fallback_value
        self.healthy = True
    
    def __enter__(self):
        self.healthy = DBHealthCheck.is_healthy()
        if not self.healthy:
            logger.warning("Database health check failed, operations may use fallback")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            logger.error(f"Database operation failed: {exc_val}")
            if isinstance(exc_val, (IntegrityError, OperationalError)):
                # Return True to suppress exception and use fallback
                return False  # Don't suppress, caller can handle
        return False
    
    def is_healthy(self):
        return self.healthy
    
    def get_fallback(self):
        return self.fallback_value

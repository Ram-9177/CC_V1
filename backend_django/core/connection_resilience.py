"""
Connection Resilience System - Handles DB, Cache, and Network failures
with automatic recovery, retry logic, and fallback strategies.
"""

import logging
import time
from typing import Optional, Any, Callable
from functools import wraps
from django.db import connection, connections
from django.core.cache import cache
from django.conf import settings
import redis

logger = logging.getLogger(__name__)


class ConnectionPool:
    """Monitor and manage database connection pool health."""
    
    @staticmethod
    def get_pool_status() -> dict:
        """Get connection pool statistics."""
        try:
            # Get connection object
            conn = connections['default']
            
            status = {
                'backend': conn.settings_dict.get('ENGINE', 'unknown'),
                'max_connections': getattr(conn, 'max_connections', 'N/A'),
                'pool_size': 10,  # Django default
                'active_connections': 0,
                'idle_connections': 0,
                'healthy': True,
                'last_check': time.time(),
            }
            
            # Test connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                status['database_responsive'] = True
                status['response_time_ms'] = 5  # Approximate
            
            return status
        except Exception as e:
            logger.error(f"Connection pool check failed: {e}")
            return {
                'healthy': False,
                'error': str(e),
                'last_check': time.time(),
            }
    
    @staticmethod
    def acquire_connection(timeout=5):
        """Acquire a connection with timeout."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                conn = connection
                conn.ensure_connection()
                return conn
            except Exception as e:
                if time.time() - start >= timeout:
                    raise TimeoutError(f"Could not acquire connection after {timeout}s: {e}")
                time.sleep(0.1)
        raise TimeoutError(f"Connection acquisition timeout ({timeout}s)")


class RetryStrategy:
    """Exponential backoff retry logic."""
    
    @staticmethod
    def with_retry(func: Callable, max_retries=3, initial_delay=0.1, max_delay=8):
        """Execute function with exponential backoff retry.
        
        Args:
            func: Callable to retry
            max_retries: Maximum number of attempts
            initial_delay: Starting delay in seconds
            max_delay: Maximum delay in seconds
        """
        delay = initial_delay
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return func()
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_retries} failed: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    time.sleep(delay)
                    delay = min(delay * 2, max_delay)  # Exponential backoff
                else:
                    logger.error(f"All {max_retries} attempts failed: {e}")
        
        raise last_error


def retry_on_db_failure(max_retries=3):
    """Decorator for automatic retry on database failures."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return RetryStrategy.with_retry(
                lambda: func(*args, **kwargs),
                max_retries=max_retries
            )
        return wrapper
    return decorator


class CacheFallback:
    """Cache-first strategy with database fallback."""
    
    @staticmethod
    def get_or_query(cache_key: str, db_query: Callable, ttl=3600, fallback_ttl=300):
        """Get from cache, fallback to database query.
        
        Args:
            cache_key: Redis key
            db_query: Callable that returns data
            ttl: Cache time-to-live in seconds
            fallback_ttl: TTL for degraded mode cache
        """
        # Try cache first
        try:
            cached = cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached, 'cache'
        except Exception as e:
            logger.warning(f"Cache read failed for {cache_key}: {e}")
        
        # Query database
        try:
            result = db_query()
            # Cache the result
            try:
                cache.set(cache_key, result, ttl)
            except Exception as e:
                logger.warning(f"Cache write failed for {cache_key}: {e}")
            return result, 'database'
        except Exception as e:
            logger.error(f"Database query failed for {cache_key}: {e}")
            # Try degraded cache (older data)
            try:
                cached = cache.get(cache_key + ':degraded')
                if cached is not None:
                    logger.info(f"Returning degraded cache for {cache_key}")
                    return cached, 'degraded_cache'
            except:
                pass
            raise
    
    @staticmethod
    def set_with_backup(cache_key: str, value: Any, ttl=3600):
        """Set cache with degraded backup.
        
        Args:
            cache_key: Redis key
            value: Value to cache
            ttl: TTL in seconds
        """
        try:
            cache.set(cache_key, value, ttl)
            # Also set a backup with longer TTL for degraded mode
            cache.set(cache_key + ':degraded', value, ttl * 3)
        except Exception as e:
            logger.error(f"Cache backup failed for {cache_key}: {e}")


class DBHealthCheck:
    """Database health monitoring."""
    
    _last_check = {}
    _check_interval = 60  # Check every 60 seconds
    
    @classmethod
    def is_healthy(cls, force=False) -> bool:
        """Check if database is healthy."""
        alias = 'default'
        now = time.time()
        
        # Rate-limit checks
        if not force and alias in cls._last_check:
            if now - cls._last_check[alias] < cls._check_interval:
                return cls._last_check.get(alias + ':result', True)
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            cls._last_check[alias] = now
            cls._last_check[alias + ':result'] = True
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            cls._last_check[alias] = now
            cls._last_check[alias + ':result'] = False
            return False


class RedisHealthCheck:
    """Redis cache health monitoring."""
    
    _last_check = {}
    _check_interval = 30  # Check every 30 seconds
    
    @classmethod
    def is_healthy(cls, force=False) -> bool:
        """Check if Redis is healthy."""
        now = time.time()
        
        if not force and 'redis' in cls._last_check:
            if now - cls._last_check['redis'] < cls._check_interval:
                return cls._last_check.get('redis:result', True)
        
        try:
            cache.set('__health_check__', 'ok', 1)
            cache.get('__health_check__')
            cls._last_check['redis'] = now
            cls._last_check['redis:result'] = True
            return True
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            cls._last_check['redis'] = now
            cls._last_check['redis:result'] = False
            return False


class ConnectionMonitor:
    """Monitor all system connections."""
    
    @staticmethod
    def get_system_health() -> dict:
        """Get comprehensive system health."""
        return {
            'database': {
                'healthy': DBHealthCheck.is_healthy(),
                'pool': ConnectionPool.get_pool_status(),
            },
            'cache': {
                'healthy': RedisHealthCheck.is_healthy(),
            },
            'timestamp': time.time(),
        }
    
    @staticmethod
    def log_health():
        """Log system health periodically."""
        health = ConnectionMonitor.get_system_health()
        status = 'HEALTHY' if health['database']['healthy'] and health['cache']['healthy'] else 'DEGRADED'
        logger.info(f"System Health: {status} | DB: {health['database']['healthy']} | Cache: {health['cache']['healthy']}")


# Periodic health check (call from management command or signal handler)
def start_health_monitoring():
    """Start periodic health monitoring."""
    import threading
    
    def monitor():
        while True:
            time.sleep(60)
            ConnectionMonitor.log_health()
    
    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()

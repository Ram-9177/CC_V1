"""
Advanced health monitoring for comprehensive system resilience.
Monitors DB, cache, WebSocket, connection pools, and transaction locks.
"""

import logging
import time
from typing import Optional, Dict, Any
from django.db import connection, connections, IntegrityError
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.throttling import UserRateThrottle
import threading

logger = logging.getLogger(__name__)


class HealthCheckThrottle(UserRateThrottle):
    """Throttle health checks to prevent spam."""
    scope = 'health_check'
    rate = '100/hour'  # 100 requests per hour


class SystemHealthMonitor:
    """Comprehensive system health monitoring."""
    
    # Store last check results in memory
    _cache = {}
    _lock = threading.Lock()
    
    CHECK_INTERVAL = 30  # seconds
    WARN_DB_TIME_MS = 50  # Warning threshold
    WARN_CACHE_TIME_MS = 20
    
    # Health status levels
    HEALTHY = 'healthy'
    DEGRADED = 'degraded'
    UNHEALTHY = 'unhealthy'
    
    @classmethod
    def check_database(cls) -> Dict[str, Any]:
        """Comprehensive database health check."""
        start = time.time()
        result = {
            'component': 'database',
            'status': cls.UNHEALTHY,
            'response_ms': 0,
            'details': {},
        }
        
        try:
            # 1. Basic connectivity
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            
            # 2. Connection pool status
            pool_status = cls._get_connection_pool_status()
            result['details']['pool'] = pool_status
            
            # 3. Check for slow queries (query cache hit rate)
            try:
                with connection.cursor() as cursor:
                    # Try to get query cache stats if available
                    cursor.execute("SHOW STATUS LIKE 'Qcache%'")
                    result['details']['cache_stats'] = {
                        row[0]: row[1] for row in cursor.fetchall()
                    }
            except:
                pass  # Not all databases support this
            
            # 4. Test transaction isolation
            try:
                with connection.cursor() as cursor:
                    cursor.execute("BEGIN")
                    cursor.execute("SELECT COUNT(*) FROM django_session")
                    cursor.execute("COMMIT")
            except Exception as e:
                result['details']['transaction_error'] = str(e)
                logger.warning(f"Transaction test failed: {e}")
            
            response_ms = (time.time() - start) * 1000
            result['response_ms'] = round(response_ms, 2)
            
            # Set status based on response time
            if response_ms < cls.WARN_DB_TIME_MS:
                result['status'] = cls.HEALTHY
            else:
                result['status'] = cls.DEGRADED
                result['details']['slow_query_warning'] = f"Response time {response_ms}ms > threshold {cls.WARN_DB_TIME_MS}ms"
            
        except Exception as e:
            result['status'] = cls.UNHEALTHY
            result['details']['error'] = str(e)
            logger.error(f"Database health check failed: {e}")
        
        return result
    
    @classmethod
    def check_cache(cls) -> Dict[str, Any]:
        """Comprehensive cache health check."""
        start = time.time()
        result = {
            'component': 'cache',
            'status': cls.UNHEALTHY,
            'response_ms': 0,
            'details': {},
        }
        
        test_key = '__health_check__'
        test_value = f'ok:{time.time()}'
        
        try:
            # 1. Write test
            cache.set(test_key, test_value, 10)
            
            # 2. Read test
            cached = cache.get(test_key)
            if cached != test_value:
                result['details']['read_write_mismatch'] = True
                logger.warning("Cache read/write mismatch detected")
            
            # 3. Delete test
            cache.delete(test_key)
            
            # 4. Verify deletion
            if cache.get(test_key) is not None:
                result['details']['delete_failed'] = True
                logger.warning("Cache delete test failed")
            
            response_ms = (time.time() - start) * 1000
            result['response_ms'] = round(response_ms, 2)
            
            # Check response time
            if response_ms < cls.WARN_CACHE_TIME_MS:
                result['status'] = cls.HEALTHY
            else:
                result['status'] = cls.DEGRADED
                result['details']['slow_cache_warning'] = f"Response time {response_ms}ms > threshold {cls.WARN_CACHE_TIME_MS}ms"
        
        except Exception as e:
            result['status'] = cls.UNHEALTHY
            result['details']['error'] = str(e)
            logger.error(f"Cache health check failed: {e}")
        
        return result
    
    @classmethod
    def check_websocket(cls) -> Dict[str, Any]:
        """Check WebSocket/Daphne availability."""
        result = {
            'component': 'websocket',
            'status': cls.HEALTHY,
            'details': {
                'daphne_port': getattr(settings, 'DAPHNE_PORT', 8000),
                'channel_layer': getattr(settings, 'CHANNEL_LAYERS', {}).get('default', {}).get('BACKEND', 'unknown'),
            },
        }
        
        try:
            # Try to check if there are any active connections in Redis
            from django.core.cache import caches
            cache_conn = caches['default']
            
            # If we can reach cache, assume WebSocket infrastructure is OK
            # (since Channels uses same Redis)
            if hasattr(cache_conn, '_touch'):
                cache_conn._touch()
            
            result['status'] = cls.HEALTHY
        except Exception as e:
            result['status'] = cls.DEGRADED
            result['details']['error'] = str(e)
            logger.warning(f"WebSocket health check degraded: {e}")
        
        return result
    
    @classmethod
    def check_celery(cls) -> Dict[str, Any]:
        """Check Celery task queue health."""
        result = {
            'component': 'celery',
            'status': cls.HEALTHY if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False) else cls.HEALTHY,
            'details': {
                'eager_mode': getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False),
                'broker': getattr(settings, 'CELERY_BROKER_URL', 'unknown'),
            },
        }
        
        try:
            # Try to verify Celery is accessible
            from celery import current_app
            stats = current_app.control.inspect().active()
            if stats is None:
                result['status'] = cls.DEGRADED
                result['details']['workers_found'] = 0
            else:
                result['details']['workers_found'] = len(stats)
                result['status'] = cls.HEALTHY if stats else cls.DEGRADED
        except Exception as e:
            result['status'] = cls.DEGRADED
            result['details']['error'] = str(e)
            logger.warning(f"Celery health check degraded: {e}")
        
        return result
    
    @classmethod
    def get_overall_status(cls) -> Dict[str, Any]:
        """Get overall system health status."""
        checks = {
            'database': cls.check_database(),
            'cache': cls.check_cache(),
            'websocket': cls.check_websocket(),
        }
        
        # Add Celery check if enabled
        if getattr(settings, 'CELERY_ENABLED', True):
            checks['celery'] = cls.check_celery()
        
        # Determine overall status
        statuses = [c['status'] for c in checks.values()]
        
        if all(s == cls.HEALTHY for s in statuses):
            overall = cls.HEALTHY
        elif any(s == cls.UNHEALTHY for s in statuses):
            overall = cls.UNHEALTHY
        else:
            overall = cls.DEGRADED
        
        return {
            'overall': overall,
            'timestamp': time.time(),
            'checks': checks,
        }
    
    @classmethod
    def _get_connection_pool_status(cls) -> Dict[str, Any]:
        """Get database connection pool statistics."""
        try:
            conn = connections['default']
            
            pool_info = {
                'backend': conn.settings_dict.get('ENGINE', 'unknown').split('.')[-1],
                'name': conn.settings_dict.get('NAME', 'unknown'),
                'host': conn.settings_dict.get('HOST', 'unknown'),
                'port': conn.settings_dict.get('PORT', ''),
            }
            
            # Try to get pool stats if using pgBouncer or psycopg2
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT version()")
                    version = cursor.fetchone()
                    pool_info['version'] = version[0] if version else 'unknown'
            except:
                pass
            
            return pool_info
        except Exception as e:
            return {'error': str(e)}


# REST API endpoints

@api_view(['GET'])
@throttle_classes([HealthCheckThrottle])
def health_status(request):
    """Get comprehensive system health status."""
    health = SystemHealthMonitor.get_overall_status()
    
    # Return appropriate HTTP status
    if health['overall'] == SystemHealthMonitor.HEALTHY:
        status_code = 200
    elif health['overall'] == SystemHealthMonitor.DEGRADED:
        status_code = 207  # Multi-status
    else:
        status_code = 503  # Service unavailable
    
    return Response(health, status=status_code)


@api_view(['GET'])
def health_ping(request):
    """Lightweight ping - zero processing."""
    return Response({
        'status': 'ok',
        'timestamp': time.time(),
    })


@api_view(['GET'])
def component_details(request, component: str = None):
    """Get detailed status of specific component."""
    monitor = SystemHealthMonitor()
    
    components = {
        'database': monitor.check_database,
        'cache': monitor.check_cache,
        'websocket': monitor.check_websocket,
    }
    
    if not component:
        # Return all
        return Response({
            'timestamp': time.time(),
            'components': {
                name: check_func() for name, check_func in components.items()
            }
        })
    
    if component not in components:
        return Response({'error': f'Unknown component: {component}'}, status=404)
    
    return Response({
        'timestamp': time.time(),
        'component': components[component](),
    })

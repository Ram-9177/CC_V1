"""Health check views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db import connection
from django.core.cache import cache
import time
from .models import HealthCheck
from .serializers import HealthCheckSerializer


class HealthCheckViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Health Checks."""

    queryset = HealthCheck.objects.all()
    serializer_class = HealthCheckSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get current health status of the system."""
        start_time = time.time()
        errors = []

        # Check database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db_status = 'healthy'
        except Exception as e:
            db_status = 'unhealthy'
            errors.append(f"Database: {str(e)}")

        # Check cache
        try:
            cache.set('health_check', 'ok', 1)
            cache.get('health_check')
            cache_status = 'healthy'
        except Exception as e:
            cache_status = 'unhealthy'
            errors.append(f"Cache: {str(e)}")

        # WebSocket status (assume healthy if others are)
        websocket_status = 'healthy' if not errors else 'degraded'

        # Calculate overall status
        if db_status == 'healthy' and cache_status == 'healthy':
            overall_status = 'healthy'
        elif db_status == 'healthy' or cache_status == 'healthy':
            overall_status = 'degraded'
        else:
            overall_status = 'unhealthy'

        response_time = int((time.time() - start_time) * 1000)

        # Throttled logging: Only create record if unhealthy OR if 5 minutes passed
        # This reduces DB writes on free-tier while maintaining history
        cache_log_key = 'last_health_log_time'
        last_log_time = cache.get(cache_log_key, 0)
        should_log = overall_status != 'healthy' or (time.time() - last_log_time) > 300

        if should_log:
            try:
                health = HealthCheck.objects.create(
                    status=overall_status,
                    database_status=db_status,
                    cache_status=cache_status,
                    websocket_status=websocket_status,
                    response_time_ms=response_time,
                    error_message=' | '.join(errors) if errors else ''
                )
                cache.set(cache_log_key, time.time(), 600)
                serializer = self.get_serializer(health)
                return Response(serializer.data)
            except Exception:
                pass  # Fallback if DB is so dead we can't even log

        # Return real-time status directly without DB persistence if throttled
        return Response({
            'status': overall_status,
            'database_status': db_status,
            'cache_status': cache_status,
            'websocket_status': websocket_status,
            'response_time_ms': response_time,
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'error_message': ' | '.join(errors) if errors else ''
        })

    @action(detail=False, methods=['get'])
    def ping(self, request):
        """Lightweight keep-alive for free-tier."""
        return Response({'status': 'pong'})

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest health check."""
        health = HealthCheck.objects.latest('created_at')
        serializer = self.get_serializer(health)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def perf(self, request):
        """
        Real-time performance snapshot for admin monitoring.
        Returns: memory RSS, DB open connections, cache latency, Redis key count.
        Restricted to authenticated users (not public) to prevent info leakage.

        Access: GET /api/health/perf/
        """
        import sys

        result = {}

        # ── Memory (RSS) ──────────────────────────────────────────────────────
        try:
            import resource as _resource
            usage = _resource.getrusage(_resource.RUSAGE_SELF)
            # ru_maxrss is in kilobytes on Linux, bytes on macOS
            import platform
            divisor = 1024 if platform.system() == 'Linux' else (1024 * 1024)
            result['memory_rss_mb'] = round(usage.ru_maxrss / divisor, 2)
        except Exception:
            result['memory_rss_mb'] = None

        # ── Database: open connections ────────────────────────────────────────
        try:
            from django.db import connections
            db_conn_count = sum(
                1 for alias in connections
                if hasattr(connections[alias], 'connection') and connections[alias].connection is not None
            )
            result['db_open_connections'] = db_conn_count
        except Exception:
            result['db_open_connections'] = None

        # ── Active DB query count for this request ────────────────────────────
        try:
            from django.db import connection as _conn
            result['request_query_count'] = len(_conn.queries)
        except Exception:
            result['request_query_count'] = None

        # ── Cache round-trip latency ──────────────────────────────────────────
        try:
            _t0 = time.perf_counter()
            cache.set('_perf_probe', 1, timeout=5)
            cache.get('_perf_probe')
            result['cache_latency_ms'] = round((time.perf_counter() - _t0) * 1000, 2)
        except Exception:
            result['cache_latency_ms'] = None

        # ── Redis key count (cache DB 1) ──────────────────────────────────────
        try:
            from django_redis import get_redis_connection
            r = get_redis_connection('default')
            result['redis_cache_key_count'] = r.dbsize()
        except Exception:
            result['redis_cache_key_count'] = None

        result['python_version'] = sys.version.split()[0]
        result['timestamp'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        return Response(result)

"""Health check views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
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
        
        # Create log
        health = HealthCheck.objects.create(
            status=overall_status,
            database_status=db_status,
            cache_status=cache_status,
            websocket_status=websocket_status,
            response_time_ms=response_time,
            error_message=' | '.join(errors) if errors else ''
        )
        
        serializer = self.get_serializer(health)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest health check."""
        health = HealthCheck.objects.latest('created_at')
        serializer = self.get_serializer(health)
        return Response(serializer.data)

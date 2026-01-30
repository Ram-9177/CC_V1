"""Health check serializers."""

from rest_framework import serializers
from .models import HealthCheck


class HealthCheckSerializer(serializers.ModelSerializer):
    """Serializer for HealthCheck model."""
    
    class Meta:
        model = HealthCheck
        fields = ['id', 'status', 'database_status', 'cache_status', 'websocket_status',
                  'response_time_ms', 'error_message', 'created_at']
        read_only_fields = ['created_at']

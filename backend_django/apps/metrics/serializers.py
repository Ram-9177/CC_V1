"""Metrics serializers."""

from rest_framework import serializers
from .models import Metric


class MetricSerializer(serializers.ModelSerializer):
    """Serializer for Metric model."""
    
    class Meta:
        model = Metric
        fields = ['id', 'metric_type', 'value', 'timestamp', 'metadata']
        read_only_fields = ['timestamp']

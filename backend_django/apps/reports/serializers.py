"""Reports serializers."""

from rest_framework import serializers
from .models import Report
from apps.auth.serializers import UserSerializer


class ReportSerializer(serializers.ModelSerializer):
    """Serializer for Report model."""
    generated_by_details = UserSerializer(source='generated_by', read_only=True)
    
    class Meta:
        model = Report
        fields = ['id', 'title', 'report_type', 'generated_by', 'generated_by_details',
                  'start_date', 'end_date', 'data', 'summary', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

"""Gate scans serializers."""

from rest_framework import serializers
from .models import GateScan
from apps.auth.serializers import UserSerializer


class GateScanSerializer(serializers.ModelSerializer):
    """Serializer for GateScan model."""
    student_details = UserSerializer(source='student', read_only=True)
    
    class Meta:
        model = GateScan
        fields = ['id', 'student', 'student_details', 'direction', 'scan_time',
                  'qr_code', 'location', 'verified', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'scan_time']

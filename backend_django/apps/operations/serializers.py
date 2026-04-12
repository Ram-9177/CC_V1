"""Operations app serializers — Phase 9."""
from rest_framework import serializers
from .models import BulkUserJob, SystemConfig, AuditAction

class BulkUserJobSerializer(serializers.ModelSerializer):
    """Bulk upload session serializer."""
    class Meta:
        model = BulkUserJob
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'status', 'total_rows', 'success_count', 'failure_count', 'error_log', 'created_at']

class SystemConfigSerializer(serializers.ModelSerializer):
    """System-wide flags and constants."""
    class Meta:
        model = SystemConfig
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class AuditActionSerializer(serializers.ModelSerializer):
    """Operational audit trail."""
    actor_name = serializers.CharField(source='actor.username', read_only=True)
    class Meta:
        model = AuditAction
        fields = '__all__'
        read_only_fields = ['actor', 'created_at', 'ip_address']

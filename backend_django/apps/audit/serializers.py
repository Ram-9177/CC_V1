from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    actor_reg_number = serializers.CharField(source='actor.registration_number', read_only=True)
    
    class ErrorDetailSerializer(serializers.Serializer):
        field = serializers.CharField()
        old = serializers.CharField()
        new = serializers.CharField()
        
    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_name', 'actor_reg_number', 
            'action', 'resource_type', 'resource_id', 'changes', 
            'ip_address', 'user_agent', 'created_at'
        ]

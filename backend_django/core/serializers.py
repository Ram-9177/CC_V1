"""Core serializers for Phase 7 launches."""
from rest_framework import serializers
from .models import UserFeedback, SystemIncident

class UserFeedbackSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.get_full_name')
    college_name = serializers.ReadOnlyField(source='college.name')

    class Meta:
        model = UserFeedback
        fields = [
            'id', 'user', 'user_name', 'college', 'college_name',
            'category', 'subject', 'message', 'url', 'created_at',
            'is_resolved', 'resolved_at'
        ]
        read_only_fields = ['user', 'college', 'is_resolved', 'resolved_at', 'created_at']

class SystemIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemIncident
        fields = '__all__'

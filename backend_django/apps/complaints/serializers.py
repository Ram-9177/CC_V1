from rest_framework import serializers
from .models import Complaint
from apps.auth.serializers import UserSerializer

class ComplaintSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id', 'student', 'student_details', 'category', 'title', 'description',
            'image', 'status', 'severity', 'assigned_to', 'assigned_to_details',
            'created_at', 'updated_at', 'resolved_at', 'is_overdue'
        ]
        read_only_fields = ['resolved_at', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        return obj.check_sla()
    
    def create(self, validated_data):
        # Auto-assign student from context if not provided (allows HR/Warden to specify a student)
        if 'student' not in validated_data:
            validated_data['student'] = self.context['request'].user
        return super().create(validated_data)

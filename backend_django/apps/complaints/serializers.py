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

    def validate(self, data):
        """Ensure tenant boundaries are strictly respected."""
        # Check student assignment
        student = data.get('student')
        assigned_to = data.get('assigned_to')
        request = self.context.get('request')
        
        user = request.user if request else None
        
        student_to_check = student if student else (self.instance.student if self.instance else user)
        
        if student_to_check and user and user.is_authenticated:
            # Staff assigning a student other than themselves
            if student_to_check.id != user.id and not getattr(user, 'is_superuser', False):
                if getattr(user, 'college_id', None) != getattr(student_to_check, 'college_id', None):
                    raise serializers.ValidationError({'student': 'Security Error: You cannot raise a complaint for a student outside your college.'})
                    
        # Check Assigned Staff assignment
        if assigned_to and student_to_check:
            if getattr(assigned_to, 'college_id', None) != getattr(student_to_check, 'college_id', None) and not getattr(assigned_to, 'is_superuser', False):
                raise serializers.ValidationError({'assigned_to': 'Security Error: You cannot assign staff from a different college.'})

        return data
    
    def create(self, validated_data):
        # Auto-assign student from context if not provided (allows HR/Warden to specify a student)
        if 'student' not in validated_data:
            validated_data['student'] = self.context['request'].user
        return super().create(validated_data)

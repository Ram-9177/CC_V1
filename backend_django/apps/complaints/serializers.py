from rest_framework import serializers
from .models import Complaint
from apps.auth.models import User
from apps.auth.serializers import UserSerializer

class ComplaintSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    student_details = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id', 'student', 'student_details', 'category', 'title', 'description',
            'image', 'status', 'severity', 'assigned_to', 'assigned_to_name',
            'created_at', 'updated_at', 'resolved_at', 'is_overdue'
        ]
        read_only_fields = ['resolved_at', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        return obj.check_sla()

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() if obj.assigned_to else None

    def get_student_details(self, obj):
        if not obj.student:
            return None
        student = obj.student
        
        # Optimize room number lookup using prefetch if available
        room_number = None
        if hasattr(student, 'active_allocation') and student.active_allocation:
             room_number = student.active_allocation[0].room.room_number
        elif hasattr(student, 'room_allocations'):
             alloc = student.room_allocations.filter(status='approved', end_date__isnull=True).first()
             room_number = alloc.room.room_number if alloc else None

        return {
            'name': student.get_full_name() or student.username,
            'hall_ticket': student.registration_number or student.username,
            'room_number': room_number
        }

    def validate(self, data):
        """Ensure tenant boundaries are strictly respected."""
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        
        # 1. Check student assignment if provided
        student = data.get('student')
        if student and user and not getattr(user, 'is_superuser', False):
            # If assigning a student other than themselves, check college match
            if student.id != user.id:
                if getattr(user, 'college_id', None) != getattr(student, 'college_id', None):
                    raise serializers.ValidationError({'student': 'Security Error: You cannot raise a complaint for a student outside your college.'})
                    
        # 2. Check Assigned Staff assignment
        assigned_to = data.get('assigned_to')
        if assigned_to:
            # Determine which student this complaint is for (passed in data, existing, or the user themselves)
            student_to_check = student if student else (self.instance.student if self.instance else user)
            
            if student_to_check:
                if getattr(assigned_to, 'college_id', None) != getattr(student_to_check, 'college_id', None) and not getattr(assigned_to, 'is_superuser', False):
                    raise serializers.ValidationError({'assigned_to': 'Security Error: You cannot assign staff from a different college.'})

        return data
    
    def create(self, validated_data):
        # Auto-assign student from context if not provided (allows HR/Warden to specify a student)
        if 'student' not in validated_data:
            validated_data['student'] = self.context['request'].user
        return super().create(validated_data)

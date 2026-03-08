"""Serializers for Leave Application system."""
from rest_framework import serializers
from .models import LeaveApplication
from apps.auth.serializers import UserSerializer


class LeaveApplicationSerializer(serializers.ModelSerializer):
    """Serializer for LeaveApplication model."""
    student_details = UserSerializer(source='student', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default=None)
    duration_days = serializers.ReadOnlyField()

    class Meta:
        model = LeaveApplication
        fields = [
            'id', 'student', 'student_details', 'leave_type',
            'start_date', 'end_date', 'reason', 'status',
            'approved_by', 'approved_by_name', 'approved_at',
            'rejection_reason', 'parent_informed', 'parent_contact',
            'destination', 'contact_during_leave',
            'attachment_url', 'notes', 'duration_days',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'student', 'approved_by', 'approved_at', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date cannot be before start date.'})
        return attrs

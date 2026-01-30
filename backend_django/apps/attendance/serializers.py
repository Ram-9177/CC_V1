"""Attendance serializers."""

from rest_framework import serializers
from .models import Attendance, AttendanceReport
from apps.auth.serializers import UserSerializer
from apps.rooms.models import RoomAllocation


class AttendanceSerializer(serializers.ModelSerializer):
    """Serializer for Attendance model."""
    user_details = UserSerializer(source='user', read_only=True)
    student = serializers.SerializerMethodField()
    date = serializers.DateField(source='attendance_date', read_only=True)
    marked_by = serializers.SerializerMethodField()
    marked_at = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Attendance
        fields = ['id', 'user', 'user_details', 'attendance_date', 'status',
                  'check_in_time', 'check_out_time', 'remarks', 'created_at', 'updated_at',
                  'student', 'date', 'marked_by', 'marked_at']
        read_only_fields = ['created_at', 'updated_at']

    def get_student(self, obj):
        user = obj.user
        allocation = RoomAllocation.objects.filter(student=user, end_date__isnull=True).select_related('room').first()
        room_number = allocation.room.room_number if allocation else None
        return {
            'id': user.id,
            'name': user.get_full_name() or user.username,
            'email': user.email,
            'room_number': room_number,
        }

    def get_marked_by(self, obj):
        return None


class AttendanceReportSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceReport model."""
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = AttendanceReport
        fields = ['id', 'user', 'user_details', 'period', 'start_date', 'end_date',
                  'total_days', 'present_days', 'absent_days', 'late_days', 
                  'excused_days', 'percentage', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'percentage']

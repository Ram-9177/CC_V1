"""Rooms app serializers."""
from rest_framework import serializers
from apps.rooms.models import Room, RoomAllocation
from apps.auth.models import User

class RoomSerializer(serializers.ModelSerializer):
    """Serializer for Room model."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    status = serializers.SerializerMethodField()
    residents = serializers.SerializerMethodField()
    
    class Meta:
        model = Room
        fields = [
            'id', 'room_number', 'floor', 'room_type', 'capacity',
            'current_occupancy', 'rent', 'is_available', 'description',
            'amenities', 'created_by', 'created_by_name', 'created_at', 'updated_at',
            'status', 'residents'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'created_by_name']

    def get_status(self, obj):
        if not obj.is_available:
            return 'maintenance'
        if obj.current_occupancy >= obj.capacity:
            return 'occupied'
        return 'available'

    def get_residents(self, obj):
        allocations = obj.allocations.filter(end_date__isnull=True).select_related('student')
        residents = []
        for allocation in allocations:
            student = allocation.student
            residents.append({
                'id': student.id,
                'name': student.get_full_name() or student.username,
                'email': student.email,
            })
        return residents


class RoomAllocationSerializer(serializers.ModelSerializer):
    """Serializer for RoomAllocation model."""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    
    class Meta:
        model = RoomAllocation
        fields = [
            'id', 'student', 'student_name', 'room', 'room_number',
            'status', 'allocated_date', 'end_date', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

"""Rooms app serializers."""
from rest_framework import serializers
from apps.rooms.models import Room, RoomAllocation, Building, Bed
from apps.auth.models import User

class BedSerializer(serializers.ModelSerializer):
    """Serializer for Bed model."""
    class Meta:
        model = Bed
        fields = ['id', 'bed_number', 'is_occupied']

class BuildingSerializer(serializers.ModelSerializer):
    """Serializer for Building model."""
    class Meta:
        model = Building
        fields = ['id', 'name', 'code', 'description', 'total_floors']

class RoomSerializer(serializers.ModelSerializer):
    """Serializer for Room model."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    status = serializers.SerializerMethodField()
    residents = serializers.SerializerMethodField()
    beds = BedSerializer(many=True, read_only=True)
    
    class Meta:
        model = Room
        fields = [
            'id', 'room_number', 'floor', 'room_type', 'capacity',
            'current_occupancy', 'rent', 'is_available', 'description',
            'amenities', 'created_by', 'created_by_name', 'created_at', 'updated_at',
            'status', 'residents', 'building', 'beds'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'created_by_name']

    def get_status(self, obj):
        if not obj.is_available:
            return 'maintenance'
        if obj.current_occupancy >= obj.capacity:
            return 'occupied'
        return 'available'

    def get_residents(self, obj):
        if hasattr(obj, 'active_allocations_list'):
            allocations = obj.active_allocations_list
        else:
            allocations = obj.allocations.filter(end_date__isnull=True, status='approved').select_related('student')
        residents = []
        for allocation in allocations:
            student = allocation.student
            residents.append({
                'id': student.id,
                'name': student.get_full_name() or student.username,
                'hall_ticket': student.registration_number or student.username,
                'username': student.username,
                'email': student.email,
            })
        return residents


class RoomAllocationSerializer(serializers.ModelSerializer):
    """Serializer for RoomAllocation model."""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_hall_ticket = serializers.CharField(source='student.username', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    bed_number = serializers.CharField(source='bed.bed_number', read_only=True)
    
    class Meta:
        model = RoomAllocation
        fields = [
            'id', 'student', 'student_name', 'student_hall_ticket', 'room', 'room_number',
            'bed', 'bed_number',
            'status', 'allocated_date', 'end_date', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

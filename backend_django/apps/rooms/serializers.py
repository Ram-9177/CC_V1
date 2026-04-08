"""Rooms app serializers."""
from rest_framework import serializers
from apps.rooms.models import Room, RoomAllocation, RoomAllocationHistory, Building, Bed, Hostel
from apps.auth.models import User

class BedSerializer(serializers.ModelSerializer):
    """Serializer for Bed model."""
    class Meta:
        model = Bed
        fields = ['id', 'bed_number', 'is_occupied']

class HostelSerializer(serializers.ModelSerializer):
    """Serializer for Hostel model."""
    college_name = serializers.CharField(source='college.name', read_only=True)
    block_count = serializers.SerializerMethodField()

    class Meta:
        model = Hostel
        fields = ['id', 'name', 'college', 'college_name', 'is_active', 'disabled_reason', 'block_count']

    def get_block_count(self, obj):
        return obj.blocks.count()

class BuildingSerializer(serializers.ModelSerializer):
    """Serializer for Building model."""
    resident_count = serializers.SerializerMethodField()
    hostel_name = serializers.CharField(source='hostel.name', read_only=True)
    hostel_is_active = serializers.BooleanField(source='hostel.is_active', read_only=True)

    class Meta:
        model = Building
        fields = [
            'id', 'name', 'code', 'description', 'total_floors',
            'gender_type', 'lunch_time_start', 'lunch_time_end', 
            'attendance_time', 'attendance_taker_role',
            'is_active', 'disabled_reason', 'resident_count',
            'hostel', 'hostel_name', 'hostel_is_active', 'disabled_floors',
            'allow_student_complaints'
        ]

    def get_resident_count(self, obj):
        """Count of active residents in this building."""
        from apps.rooms.models import RoomAllocation
        return RoomAllocation.objects.filter(
            room__building=obj,
            end_date__isnull=True,
            status='approved'
        ).count()

class RoomSerializer(serializers.ModelSerializer):
    """Serializer for Room model."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    status = serializers.SerializerMethodField()
    residents = serializers.SerializerMethodField()
    beds = BedSerializer(many=True, read_only=True)
    building_is_active = serializers.SerializerMethodField()
    is_floor_disabled = serializers.SerializerMethodField()
    
    class Meta:
        model = Room
        fields = [
            'id', 'room_number', 'floor', 'room_type', 'capacity',
            'current_occupancy', 'rent', 'is_available', 'description',
            'amenities', 'created_by', 'created_by_name', 'created_at', 'updated_at',
            'status', 'residents', 'building', 'beds', 'single_beds', 'double_beds',
            'building_is_active', 'is_floor_disabled'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'created_by_name']

    def get_status(self, obj):
        if not obj.is_available:
            return 'maintenance'
        
        # Check hierarchy for offline status
        if obj.building:
            if not obj.building.is_active or (obj.building.hostel and not obj.building.hostel.is_active):
                return 'offline'
            if obj.floor in (obj.building.disabled_floors or []):
                return 'offline'

        if obj.current_occupancy >= obj.capacity:
            return 'occupied'
        return 'available'

    def get_building_is_active(self, obj):
        if not obj.building: return True
        return obj.building.is_active and (not obj.building.hostel or obj.building.hostel.is_active)

    def get_is_floor_disabled(self, obj):
        if not obj.building: return False
        return obj.floor in (obj.building.disabled_floors or [])

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

    def validate(self, data):
        """Ensure tenant boundaries are strictly respected."""
        student = data.get('student')
        room = data.get('room')
        
        # Ensure student and room exist and determine colleges
        if student and room:
            student_college = getattr(student, 'college_id', None)
            
            # Navigate to room's college
            room_college = None
            if room.building and room.building.hostel:
                room_college = room.building.hostel.college_id
                
            # Both must belong to a college, and it must be the exact SAME college
            if student_college and room_college and student_college != room_college:
                raise serializers.ValidationError('Security Error: Tenant isolation violation. Student and Room must belong to the same college.')

        return data


class RoomAllocationHistorySerializer(serializers.ModelSerializer):
    """Serializer for RoomAllocationHistory model."""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    changed_by_name = serializers.CharField(source='changed_by.get_full_name', read_only=True)
    from_room_number = serializers.CharField(source='from_room.room_number', read_only=True, default=None)
    to_room_number = serializers.CharField(source='to_room.room_number', read_only=True, default=None)
    from_bed_number = serializers.CharField(source='from_bed.bed_number', read_only=True, default=None)
    to_bed_number = serializers.CharField(source='to_bed.bed_number', read_only=True, default=None)

    class Meta:
        model = RoomAllocationHistory
        fields = [
            'id', 'student', 'student_name', 'action',
            'from_room', 'from_room_number', 'to_room', 'to_room_number',
            'from_bed', 'from_bed_number', 'to_bed', 'to_bed_number',
            'changed_by', 'changed_by_name', 'details', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


from apps.rooms.models import RoomRequest

class RoomRequestSerializer(serializers.ModelSerializer):
    """Serializer for student room change requests."""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_hall_ticket = serializers.CharField(source='student.username', read_only=True)
    target_room_number = serializers.CharField(source='target_room.room_number', read_only=True)
    target_bed_number = serializers.CharField(source='target_bed.bed_number', read_only=True)
    handled_by_name = serializers.CharField(source='handled_by.get_full_name', read_only=True)
    
    class Meta:
        model = RoomRequest
        fields = [
            'id', 'student', 'student_name', 'student_hall_ticket',
            'preferred_room_type', 'reason', 'status',
            'target_room', 'target_room_number', 'target_bed', 'target_bed_number',
            'handled_by', 'handled_by_name', 'remarks', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'student', 'status', 'handled_by', 'created_at', 'updated_at']

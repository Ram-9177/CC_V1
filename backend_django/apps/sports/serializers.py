"""Sports app serializers — Phase 6."""
from rest_framework import serializers
from django.utils import timezone

from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportBooking,
    SportCourt,
    SportEquipment,
    SportEquipmentIssue,
    SportFacility,
    SportsMatch,
    SportsPolicy,
    SportSlotBooking,
)
from apps.auth.serializers import UserSerializer

class SportFacilitySerializer(serializers.ModelSerializer):
    """Sport Facility serializer."""
    class Meta:
        model = SportFacility
        fields = '__all__'
        read_only_fields = ['college', 'created_at', 'updated_at']

class SportBookingSerializer(serializers.ModelSerializer):
    """Sport Booking serializer."""
    booked_by_details = UserSerializer(source='booked_by', read_only=True)
    facility_details = SportFacilitySerializer(source='facility', read_only=True)
    
    class Meta:
        model = SportBooking
        fields = '__all__'
        read_only_fields = ['booked_by', 'created_at', 'updated_at']

class SportsMatchSerializer(serializers.ModelSerializer):
    """Sports Match serializer."""
    facility_details = SportFacilitySerializer(source='facility', read_only=True)
    organizer_details = UserSerializer(source='organizer', read_only=True)
    
    class Meta:
        model = SportsMatch
        fields = '__all__'
        read_only_fields = ['organizer', 'created_at', 'updated_at']


# ---------------------------------------------------------------------------
# Frontend-compatible Sports serializers
# ---------------------------------------------------------------------------


class SportCompactUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True, allow_blank=True)
    role = serializers.CharField(read_only=True)
    registration_number = serializers.CharField(read_only=True, allow_blank=True)


class SportSerializer(serializers.ModelSerializer):
    courts_count = serializers.SerializerMethodField()

    class Meta:
        model = Sport
        fields = [
            'id',
            'name',
            'min_players',
            'max_players',
            'game_type',
            'status',
            'icon',
            'description',
            'courts_count',
            'created_at',
            'updated_at',
        ]

    def get_courts_count(self, obj):
        return obj.courts.count()


class SportCourtSerializer(serializers.ModelSerializer):
    sport_details = SportSerializer(source='sport', read_only=True)
    active_slots_today = serializers.SerializerMethodField()

    class Meta:
        model = SportCourt
        fields = [
            'id',
            'name',
            'sport',
            'sport_details',
            'location',
            'capacity',
            'status',
            'notes',
            'active_slots_today',
            'created_at',
            'updated_at',
        ]

    def get_active_slots_today(self, obj):
        return obj.slots.filter(date=timezone.localdate()).count()


class CourtSlotSerializer(serializers.ModelSerializer):
    court_details = SportCourtSerializer(source='court', read_only=True)
    current_bookings = serializers.SerializerMethodField()
    vacancy = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    is_match_ready = serializers.SerializerMethodField()
    waitlist_count = serializers.SerializerMethodField()

    class Meta:
        model = CourtSlot
        fields = [
            'id',
            'court',
            'court_details',
            'date',
            'start_time',
            'end_time',
            'max_players',
            'notes',
            'current_bookings',
            'vacancy',
            'is_full',
            'is_match_ready',
            'waitlist_count',
            'created_at',
        ]

    def validate(self, attrs):
        court = attrs.get('court') or getattr(self.instance, 'court', None)
        slot_date = attrs.get('date') or getattr(self.instance, 'date', None)
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')

        if self.instance is not None:
            if start_time is None:
                start_time = self.instance.start_time
            if end_time is None:
                end_time = self.instance.end_time

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError('end_time must be after start_time.')

        if court and slot_date and start_time and end_time:
            overlap_qs = CourtSlot.objects.filter(
                court=court,
                date=slot_date,
                start_time__lt=end_time,
                end_time__gt=start_time,
            )
            if self.instance is not None:
                overlap_qs = overlap_qs.exclude(id=self.instance.id)
            if overlap_qs.exists():
                raise serializers.ValidationError('This slot overlaps an existing slot for the same court.')

        return attrs

    def get_current_bookings(self, obj):
        return obj.current_bookings

    def get_vacancy(self, obj):
        return obj.vacancy

    def get_is_full(self, obj):
        return obj.is_full

    def get_is_match_ready(self, obj):
        return obj.is_match_ready

    def get_waitlist_count(self, obj):
        return obj.waitlist_count


class SportsPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = SportsPolicy
        fields = [
            'id',
            'max_bookings_per_day',
            'max_bookings_per_week',
            'allow_same_sport_same_day',
            'booking_window_days',
            'created_at',
            'updated_at',
        ]


class SportSlotBookingSerializer(serializers.ModelSerializer):
    slot_details = CourtSlotSerializer(source='slot', read_only=True)
    student_details = serializers.SerializerMethodField()
    qr_data = serializers.SerializerMethodField()
    waitlist_position = serializers.SerializerMethodField()

    class Meta:
        model = SportSlotBooking
        fields = [
            'id',
            'slot',
            'slot_details',
            'student',
            'student_details',
            'status',
            'qr_token',
            'qr_data',
            'waitlist_position',
            'check_in_time',
            'checked_in_by',
            'created_at',
        ]
        read_only_fields = [
            'student',
            'status',
            'qr_token',
            'qr_data',
            'check_in_time',
            'checked_in_by',
            'created_at',
        ]

    def get_student_details(self, obj):
        user = obj.student
        name = user.get_full_name().strip() or user.username
        return {
            'id': user.id,
            'name': name,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'registration_number': user.registration_number,
        }

    def get_qr_data(self, obj):
        return obj.qr_data

    def get_waitlist_position(self, obj):
        if obj.status != 'waitlisted':
            return None

        return (
            SportSlotBooking.objects.filter(
                slot=obj.slot,
                status='waitlisted',
                created_at__lt=obj.created_at,
            ).count()
            + 1
        )


class SportAttendanceSerializer(serializers.ModelSerializer):
    scanned_by_details = serializers.SerializerMethodField()

    class Meta:
        model = SportAttendance
        fields = ['id', 'booking', 'scanned_by', 'scanned_by_details', 'notes', 'created_at']

    def get_scanned_by_details(self, obj):
        if not obj.scanned_by:
            return None
        user = obj.scanned_by
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
            'role': user.role,
        }


class SportEquipmentSerializer(serializers.ModelSerializer):
    sport_details = SportSerializer(source='sport', read_only=True)
    available_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    active_issues = serializers.SerializerMethodField()

    class Meta:
        model = SportEquipment
        fields = [
            'id',
            'sport',
            'sport_details',
            'name',
            'category',
            'total_quantity',
            'issued_quantity',
            'available_quantity',
            'low_stock_threshold',
            'is_low_stock',
            'active_issues',
            'status',
            'storage_location',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'issued_quantity',
            'available_quantity',
            'is_low_stock',
            'active_issues',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        total_quantity = attrs.get('total_quantity', getattr(self.instance, 'total_quantity', 0))
        issued_quantity = attrs.get('issued_quantity', getattr(self.instance, 'issued_quantity', 0))

        if total_quantity < issued_quantity:
            raise serializers.ValidationError({'total_quantity': 'Total quantity cannot be lower than issued quantity.'})

        return attrs

    def get_available_quantity(self, obj):
        return obj.available_quantity

    def get_is_low_stock(self, obj):
        return obj.is_low_stock

    def get_active_issues(self, obj):
        return obj.issues.filter(status='issued').count()


class SportEquipmentIssueSerializer(serializers.ModelSerializer):
    equipment_details = SportEquipmentSerializer(source='equipment', read_only=True)
    issued_to_lookup = serializers.CharField(write_only=True, required=False, allow_blank=False)
    issued_to_details = serializers.SerializerMethodField()
    issued_by_details = serializers.SerializerMethodField()
    returned_by_details = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = SportEquipmentIssue
        fields = [
            'id',
            'equipment',
            'equipment_details',
            'issued_to',
            'issued_to_lookup',
            'issued_to_details',
            'issued_by',
            'issued_by_details',
            'returned_by',
            'returned_by_details',
            'quantity',
            'status',
            'due_back_at',
            'returned_at',
            'is_overdue',
            'notes',
            'created_at',
        ]
        read_only_fields = [
            'issued_to',
            'issued_by',
            'returned_by',
            'status',
            'returned_at',
            'is_overdue',
            'created_at',
        ]

    def create(self, validated_data):
        validated_data.pop('issued_to_lookup', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('issued_to_lookup', None)
        return super().update(instance, validated_data)

    def get_issued_to_details(self, obj):
        user = obj.issued_to
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
            'username': user.username,
            'role': user.role,
            'registration_number': user.registration_number,
        }

    def get_issued_by_details(self, obj):
        if not obj.issued_by:
            return None

        user = obj.issued_by
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
            'role': user.role,
        }

    def get_returned_by_details(self, obj):
        if not obj.returned_by:
            return None

        user = obj.returned_by
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
            'role': user.role,
        }

    def get_is_overdue(self, obj):
        return obj.is_overdue


class DepartmentSportsRequestSerializer(serializers.ModelSerializer):
    requesting_hod_details = serializers.SerializerMethodField()
    sport_details = SportSerializer(source='sport', read_only=True)
    preferred_court_details = SportCourtSerializer(source='preferred_court', read_only=True)
    reviewed_by_details = serializers.SerializerMethodField()
    allocated_slot_details = CourtSlotSerializer(source='allocated_slot', read_only=True)

    class Meta:
        model = DepartmentSportsRequest
        fields = [
            'id',
            'title',
            'requesting_hod',
            'requesting_hod_details',
            'sport',
            'sport_details',
            'preferred_court',
            'preferred_court_details',
            'requested_date',
            'requested_start_time',
            'requested_end_time',
            'department',
            'year_of_study',
            'estimated_players',
            'notes',
            'status',
            'reviewed_by',
            'reviewed_by_details',
            'allocated_slot',
            'allocated_slot_details',
            'rejection_reason',
            'created_at',
        ]
        read_only_fields = [
            'requesting_hod',
            'reviewed_by',
            'allocated_slot',
            'status',
            'created_at',
        ]

    def get_requesting_hod_details(self, obj):
        user = obj.requesting_hod
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
            'role': user.role,
        }

    def get_reviewed_by_details(self, obj):
        if not obj.reviewed_by:
            return None
        user = obj.reviewed_by
        return {
            'id': user.id,
            'name': user.get_full_name().strip() or user.username,
        }

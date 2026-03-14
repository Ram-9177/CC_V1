"""Serializers for the sports module."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportBooking,
    SportCourt,
    SportsPolicy,
)

User = get_user_model()


class UserMinSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'username', 'email', 'role', 'registration_number']


# ─── Sport ────────────────────────────────────────────────────────────────────

class SportSerializer(serializers.ModelSerializer):
    courts_count = serializers.SerializerMethodField()

    class Meta:
        model = Sport
        fields = '__all__'

    def get_courts_count(self, obj):
        return obj.courts.filter(status='open').count()


# ─── SportCourt ───────────────────────────────────────────────────────────────

class SportCourtSerializer(serializers.ModelSerializer):
    sport_details = SportSerializer(source='sport', read_only=True)
    active_slots_today = serializers.SerializerMethodField()

    class Meta:
        model = SportCourt
        fields = '__all__'

    def get_active_slots_today(self, obj):
        from django.utils import timezone
        today = timezone.localdate()
        return obj.slots.filter(date=today).count()


# ─── CourtSlot ────────────────────────────────────────────────────────────────

class CourtSlotSerializer(serializers.ModelSerializer):
    court_details = SportCourtSerializer(source='court', read_only=True)
    current_bookings = serializers.SerializerMethodField()
    vacancy = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    is_match_ready = serializers.SerializerMethodField()

    class Meta:
        model = CourtSlot
        fields = '__all__'

    def get_current_bookings(self, obj):
        return obj.current_bookings

    def get_vacancy(self, obj):
        return obj.vacancy

    def get_is_full(self, obj):
        return obj.is_full

    def get_is_match_ready(self, obj):
        return obj.is_match_ready


# ─── SportsPolicy ─────────────────────────────────────────────────────────────

class SportsPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = SportsPolicy
        fields = '__all__'


# ─── SportBooking ─────────────────────────────────────────────────────────────

class SportBookingSerializer(serializers.ModelSerializer):
    slot_details = CourtSlotSerializer(source='slot', read_only=True)
    student_details = UserMinSerializer(source='student', read_only=True)
    qr_data = serializers.SerializerMethodField()

    class Meta:
        model = SportBooking
        fields = '__all__'
        read_only_fields = [
            'student', 'status', 'qr_token', 'check_in_time', 'checked_in_by',
        ]

    def get_qr_data(self, obj):
        return obj.qr_data


# ─── SportAttendance ──────────────────────────────────────────────────────────

class SportAttendanceSerializer(serializers.ModelSerializer):
    scanned_by_details = UserMinSerializer(source='scanned_by', read_only=True)

    class Meta:
        model = SportAttendance
        fields = '__all__'


# ─── DepartmentSportsRequest ──────────────────────────────────────────────────

class DepartmentSportsRequestSerializer(serializers.ModelSerializer):
    requesting_hod_details = UserMinSerializer(source='requesting_hod', read_only=True)
    sport_details = SportSerializer(source='sport', read_only=True)
    preferred_court_details = SportCourtSerializer(source='preferred_court', read_only=True)
    reviewed_by_details = UserMinSerializer(source='reviewed_by', read_only=True)
    allocated_slot_details = CourtSlotSerializer(source='allocated_slot', read_only=True)

    class Meta:
        model = DepartmentSportsRequest
        fields = '__all__'
        read_only_fields = [
            'requesting_hod', 'status', 'reviewed_by', 'allocated_slot', 'rejection_reason',
        ]

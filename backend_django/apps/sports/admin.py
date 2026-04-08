from django.contrib import admin
from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportBooking,
    SportCourt,
    SportFacility,
    SportsMatch,
    SportsPolicy,
    SportSlotBooking,
)

@admin.register(SportFacility)
class SportFacilityAdmin(admin.ModelAdmin):
    list_display = ['name', 'capacity', 'is_active', 'college']
    list_filter = ['is_active', 'college']

@admin.register(SportBooking)
class SportBookingAdmin(admin.ModelAdmin):
    list_display = ['facility', 'booked_by', 'start_time', 'end_time', 'status']
    list_filter = ['status']

@admin.register(SportsMatch)
class SportsMatchAdmin(admin.ModelAdmin):
    list_display = ['title', 'scheduled_time', 'facility', 'status']
    list_filter = ['status']


@admin.register(Sport)
class SportAdmin(admin.ModelAdmin):
    list_display = ['name', 'game_type', 'status', 'min_players', 'max_players', 'college']
    list_filter = ['status', 'game_type', 'college']
    search_fields = ['name']


@admin.register(SportCourt)
class SportCourtAdmin(admin.ModelAdmin):
    list_display = ['name', 'sport', 'status', 'capacity', 'location', 'college']
    list_filter = ['status', 'sport', 'college']
    search_fields = ['name', 'location']


@admin.register(CourtSlot)
class CourtSlotAdmin(admin.ModelAdmin):
    list_display = ['court', 'date', 'start_time', 'end_time', 'max_players']
    list_filter = ['date', 'court__sport']
    search_fields = ['court__name']


@admin.register(SportsPolicy)
class SportsPolicyAdmin(admin.ModelAdmin):
    list_display = ['college', 'max_bookings_per_day', 'max_bookings_per_week', 'booking_window_days']


@admin.register(SportSlotBooking)
class SportSlotBookingAdmin(admin.ModelAdmin):
    list_display = ['slot', 'student', 'status', 'check_in_time', 'created_at']
    list_filter = ['status', 'slot__date']
    search_fields = ['student__username', 'student__registration_number', 'qr_token']


@admin.register(SportAttendance)
class SportAttendanceAdmin(admin.ModelAdmin):
    list_display = ['booking', 'scanned_by', 'created_at']
    search_fields = ['booking__student__username']


@admin.register(DepartmentSportsRequest)
class DepartmentSportsRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'sport', 'department', 'requested_date', 'status', 'requesting_hod']
    list_filter = ['status', 'sport', 'department']
    search_fields = ['title', 'department', 'requesting_hod__username']

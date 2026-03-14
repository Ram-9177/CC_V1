from django.contrib import admin

from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportBooking,
    SportCourt,
    SportsPolicy,
)


@admin.register(Sport)
class SportAdmin(admin.ModelAdmin):
    list_display = ['name', 'game_type', 'min_players', 'max_players', 'status']
    list_filter = ['status', 'game_type']
    search_fields = ['name']


@admin.register(SportCourt)
class SportCourtAdmin(admin.ModelAdmin):
    list_display = ['name', 'sport', 'location', 'capacity', 'status']
    list_filter = ['status', 'sport']
    search_fields = ['name', 'location']


@admin.register(CourtSlot)
class CourtSlotAdmin(admin.ModelAdmin):
    list_display = ['court', 'date', 'start_time', 'end_time', 'max_players']
    list_filter = ['court__sport', 'date']
    date_hierarchy = 'date'


@admin.register(SportsPolicy)
class SportsPolicyAdmin(admin.ModelAdmin):
    list_display = ['max_bookings_per_day', 'max_bookings_per_week', 'allow_same_sport_same_day']


@admin.register(SportBooking)
class SportBookingAdmin(admin.ModelAdmin):
    list_display = ['student', 'slot', 'status', 'check_in_time', 'created_at']
    list_filter = ['status', 'slot__court__sport']
    search_fields = ['student__name', 'student__username']


@admin.register(SportAttendance)
class SportAttendanceAdmin(admin.ModelAdmin):
    list_display = ['booking', 'scanned_by', 'created_at']


@admin.register(DepartmentSportsRequest)
class DepartmentSportsRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'requesting_hod', 'sport', 'requested_date', 'status']
    list_filter = ['status', 'sport']
    search_fields = ['title', 'department']

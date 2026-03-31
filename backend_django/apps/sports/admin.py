from django.contrib import admin
from apps.sports.models import (
    Sport, SportCourt, CourtSlot, SportBooking, 
    SportFacility, SportsMatch, SportsPolicy, 
    SportAttendance, DepartmentSportsRequest
)

@admin.register(Sport)
class SportAdmin(admin.ModelAdmin):
    list_display = ['name', 'game_type', 'status']

@admin.register(SportCourt)
class SportCourtAdmin(admin.ModelAdmin):
    list_display = ['name', 'sport', 'location', 'status']
    list_filter = ['sport', 'status']

@admin.register(CourtSlot)
class CourtSlotAdmin(admin.ModelAdmin):
    list_display = ['court', 'date', 'start_time', 'end_time']
    list_filter = ['date', 'court']

@admin.register(SportBooking)
class SportBookingAdmin(admin.ModelAdmin):
    list_display = ['student', 'slot', 'status']
    list_filter = ['status']

@admin.register(SportFacility)
class SportFacilityAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'is_active']

@admin.register(SportsMatch)
class SportsMatchAdmin(admin.ModelAdmin):
    list_display = ['title', 'match_date', 'is_completed']

@admin.register(SportsPolicy)
class SportsPolicyAdmin(admin.ModelAdmin):
    list_display = ['max_bookings_per_day', 'max_bookings_per_week']

@admin.register(SportAttendance)
class SportAttendanceAdmin(admin.ModelAdmin):
    list_display = ['booking', 'scanned_by', 'created_at']

@admin.register(DepartmentSportsRequest)
class DepartmentSportsRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'status']

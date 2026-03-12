"""Admin configuration for hall booking module."""

from django.contrib import admin

from .models import Hall, HallBooking


@admin.register(Hall)
class HallAdmin(admin.ModelAdmin):
    list_display = ('hall_id', 'hall_name', 'capacity', 'location', 'is_active')
    search_fields = ('hall_id', 'hall_name', 'location')
    list_filter = ('is_active',)


@admin.register(HallBooking)
class HallBookingAdmin(admin.ModelAdmin):
    list_display = (
        'event_name',
        'hall',
        'requester',
        'booking_date',
        'start_time',
        'end_time',
        'status',
    )
    search_fields = ('event_name', 'hall__hall_name', 'requester__username')
    list_filter = ('status', 'booking_date')

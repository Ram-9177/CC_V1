"""Admin configuration for hall booking module."""

from django.contrib import admin

from .models import Hall, HallAttendance, HallBooking, HallEquipment, HallEquipmentBooking, HallSlot


@admin.register(Hall)
class HallAdmin(admin.ModelAdmin):
    list_display = ('hall_id', 'hall_name', 'capacity', 'location', 'status', 'is_active')
    search_fields = ('hall_id', 'hall_name', 'location')
    list_filter = ('status', 'is_active')


@admin.register(HallSlot)
class HallSlotAdmin(admin.ModelAdmin):
    list_display = ('hall', 'start_time', 'end_time', 'status', 'is_active')
    search_fields = ('hall__hall_name',)
    list_filter = ('status', 'is_active')


@admin.register(HallEquipment)
class HallEquipmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    search_fields = ('name',)
    list_filter = ('is_active',)


@admin.register(HallBooking)
class HallBookingAdmin(admin.ModelAdmin):
    list_display = (
        'event_name',
        'department',
        'hall',
        'requester',
        'booking_date',
        'start_time',
        'end_time',
        'status',
    )
    search_fields = ('event_name', 'hall__hall_name', 'requester__username')
    list_filter = ('status', 'booking_date')


@admin.register(HallEquipmentBooking)
class HallEquipmentBookingAdmin(admin.ModelAdmin):
    list_display = ('booking', 'equipment', 'created_at')
    search_fields = ('booking__event_name', 'equipment__name')


@admin.register(HallAttendance)
class HallAttendanceAdmin(admin.ModelAdmin):
    list_display = ('booking', 'attendee_name', 'attendee_identifier', 'scan_method', 'scanned_by', 'created_at')
    search_fields = ('booking__event_name', 'attendee_name', 'attendee_identifier')
    list_filter = ('scan_method',)

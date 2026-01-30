"""Rooms app admin."""
from django.contrib import admin
from apps.rooms.models import Room, RoomAllocation

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['room_number', 'floor', 'room_type', 'capacity', 'is_available', 'created_at']
    list_filter = ['floor', 'room_type', 'is_available']
    search_fields = ['room_number']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(RoomAllocation)
class RoomAllocationAdmin(admin.ModelAdmin):
    list_display = ['student', 'room', 'status', 'allocated_date', 'created_at']
    list_filter = ['status', 'allocated_date']
    search_fields = ['student__username', 'room__room_number']
    readonly_fields = ['created_at', 'updated_at']

"""Gate passes admin."""

from django.contrib import admin
from .models import GatePass, GateScan


@admin.register(GatePass)
class GatePassAdmin(admin.ModelAdmin):
    list_display = ['student', 'pass_type', 'status', 'exit_date', 'approved_by']
    list_filter = ['status', 'pass_type', 'exit_date']
    search_fields = ['student__username', 'destination']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Student Info', {'fields': ['student']}),
        ('Pass Details', {'fields': ['pass_type', 'destination', 'reason', 'exit_date', 'entry_date']}),
        ('Approval', {'fields': ['status', 'approved_by', 'approval_remarks']}),
        ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
    )


@admin.register(GateScan)
class GateScanAdmin(admin.ModelAdmin):
    list_display = ['student', 'direction', 'scan_time', 'location']
    list_filter = ['direction', 'scan_time']
    search_fields = ['student__username', 'qr_code']
    readonly_fields = ['created_at', 'updated_at', 'scan_time']
    
    fieldsets = (
        ('Scan Info', {'fields': ['student', 'direction', 'scan_time', 'location']}),
        ('QR Code', {'fields': ['qr_code', 'gate_pass']}),
        ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
    )

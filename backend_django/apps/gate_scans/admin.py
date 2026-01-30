"""Gate scans admin."""

from django.contrib import admin
from .models import GateScan


@admin.register(GateScan)
class GateScanAdmin(admin.ModelAdmin):
    list_display = ['student', 'direction', 'scan_time', 'location', 'verified']
    list_filter = ['direction', 'scan_time', 'verified']
    search_fields = ['student__username', 'qr_code']
    readonly_fields = ['created_at', 'updated_at', 'scan_time']

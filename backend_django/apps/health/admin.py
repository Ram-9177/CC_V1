"""Health check admin."""

from django.contrib import admin
from .models import HealthCheck


@admin.register(HealthCheck)
class HealthCheckAdmin(admin.ModelAdmin):
    list_display = ['status', 'database_status', 'cache_status', 'websocket_status', 'created_at']
    list_filter = ['status', 'created_at']
    readonly_fields = ['created_at']

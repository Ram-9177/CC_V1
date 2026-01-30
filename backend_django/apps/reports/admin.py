"""Reports admin."""

from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'generated_by', 'start_date', 'end_date']
    list_filter = ['report_type', 'created_at']
    search_fields = ['title']
    readonly_fields = ['created_at', 'updated_at', 'data']

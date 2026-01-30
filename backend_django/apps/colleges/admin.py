"""Colleges admin."""

from django.contrib import admin
from .models import College


@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'city', 'state']
    list_filter = ['state', 'city']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']

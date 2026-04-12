"""Colleges admin."""

from django.contrib import admin
from .models import College, CollegeModuleConfig


class CollegeModuleConfigInline(admin.TabularInline):
    model = CollegeModuleConfig
    extra = 0
    fields = ['module_name', 'is_enabled', 'updated_at']
    readonly_fields = ['updated_at']


@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'city', 'state', 'subscription_status', 'is_active', 'user_count']
    list_filter = ['state', 'is_active', 'subscription_status']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [CollegeModuleConfigInline]

    @admin.display(description='Users')
    def user_count(self, obj):
        return obj.users.count()


@admin.register(CollegeModuleConfig)
class CollegeModuleConfigAdmin(admin.ModelAdmin):
    list_display = ['college', 'module_name', 'is_enabled', 'updated_at']
    list_filter = ['is_enabled', 'module_name']
    search_fields = ['college__name', 'college__code', 'module_name']
    readonly_fields = ['created_at', 'updated_at']

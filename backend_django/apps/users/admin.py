"""Users app admin."""
from django.contrib import admin
from apps.users.models import Tenant

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'guardian_name', 'created_at']
    search_fields = ['user__username', 'guardian_name']

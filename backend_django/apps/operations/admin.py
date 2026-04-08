from django.contrib import admin
from .models import BulkUserJob, SystemConfig, AuditAction

@admin.register(BulkUserJob)
class BulkUserJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'file_name', 'status', 'success_count', 'failure_count', 'uploaded_by']
    list_filter = ['status', 'college']
    search_fields = ['file_name']

@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'college']
    list_filter = ['college']
    search_fields = ['key']

@admin.register(AuditAction)
class AuditActionAdmin(admin.ModelAdmin):
    list_display = ['actor', 'action', 'entity_type', 'entity_id', 'created_at']
    list_filter = ['action', 'entity_type']
    search_fields = ['actor__username', 'entity_id']

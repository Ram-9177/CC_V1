from django.contrib import admin
from .models import LeaveApplication

@admin.register(LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display = ['student', 'leave_type', 'start_date', 'end_date', 'status', 'created_at']
    list_filter = ['leave_type', 'status', 'created_at']
    search_fields = ['student__username', 'student__registration_number', 'reason']
    readonly_fields = ['created_at', 'updated_at']

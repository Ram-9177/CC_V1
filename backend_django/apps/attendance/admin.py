"""Attendance admin configuration."""

from django.contrib import admin
from .models import Attendance, AttendanceReport


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'attendance_date', 'status', 'check_in_time', 'check_out_time']
    list_filter = ['status', 'attendance_date']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Info', {'fields': ['user']}),
        ('Attendance Data', {'fields': ['attendance_date', 'status', 'check_in_time', 'check_out_time']}),
        ('Remarks', {'fields': ['remarks']}),
        ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
    )


@admin.register(AttendanceReport)
class AttendanceReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'period', 'start_date', 'end_date', 'percentage']
    list_filter = ['period', 'start_date']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at', 'percentage']
    
    fieldsets = (
        ('User & Period', {'fields': ['user', 'period', 'start_date', 'end_date']}),
        ('Statistics', {'fields': ['total_days', 'present_days', 'absent_days', 'late_days', 'excused_days', 'percentage']}),
        ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
    )

from django.contrib import admin
from .models import DailyHostelMetrics, DashboardSummary, GatePassListView, ComplaintSummary

@admin.register(DailyHostelMetrics)
class DailyHostelMetricsAdmin(admin.ModelAdmin):
    list_display = ['date', 'tenant_id', 'total_students', 'students_present', 'gate_passes_issued']
    list_filter = ['date', 'tenant_id']
    search_fields = ['date', 'tenant_id']

@admin.register(DashboardSummary)
class DashboardSummaryAdmin(admin.ModelAdmin):
    list_display = ['viewer_role', 'tenant_id', 'expires_at']
    list_filter = ['viewer_role', 'tenant_id']

@admin.register(GatePassListView)
class GatePassListViewAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'registration_num', 'status', 'room_info', 'tenant_id']
    list_filter = ['status', 'tenant_id']
    search_fields = ['student_name', 'registration_num']

@admin.register(ComplaintSummary)
class ComplaintSummaryAdmin(admin.ModelAdmin):
    list_display = ['category', 'tenant_id', 'total_open', 'breach_count']
    list_filter = ['category', 'tenant_id']

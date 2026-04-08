from django.db import models
from core.models import CampusBaseModel
from django.utils import timezone

class DailyHostelMetrics(CampusBaseModel):
    """
    Pre-aggregated institutional metrics for high-speed reporting.
    Updated every 15-30 minutes via Celery.
    """
    date = models.DateField(db_index=True)
    
    # Counts
    total_students = models.PositiveIntegerField(default=0)
    students_present = models.PositiveIntegerField(default=0)
    students_outside = models.PositiveIntegerField(default=0)
    students_on_leave = models.PositiveIntegerField(default=0)
    
    # Gate Pass Activity
    gate_passes_issued = models.PositiveIntegerField(default=0)
    late_returns_detected = models.PositiveIntegerField(default=0)
    
    # Complaint Distribution (JSON for high-performance retrieval)
    complaint_counts_by_category = models.JSONField(default=dict, help_text="Category-wise count of current open complaints.")
    avg_resolution_time_hrs = models.FloatField(default=0.0)
    
    class Meta:
        verbose_name_plural = "Daily Hostel Metrics"
        unique_together = ('date', 'tenant_id')
        ordering = ['-date']

class DashboardSummary(CampusBaseModel):
    """
    High-performance semi-static snapshot for management dashboards.
    Denormalized for zero-join retrieval.
    """
    viewer_role = models.CharField(max_length=50, db_index=True)
    summary_data = models.JSONField(help_text="Serialized dashboard state.")
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        verbose_name_plural = "Dashboard Summaries"
        indexes = [
            models.Index(fields=['tenant_id', 'viewer_role', 'expires_at']),
        ]

class GatePassListView(CampusBaseModel):
    """
    Flattened 'Read Model' for high-speed security scan queues.
    Avoids expensive Student-Room-Building JOINs.
    """
    gatepass_id = models.UUIDField(db_index=True)
    student_name = models.CharField(max_length=200)
    registration_num = models.CharField(max_length=50, db_index=True)
    room_info = models.CharField(max_length=100) # e.g. "B1-F2-201"
    status = models.CharField(max_length=20, db_index=True)
    exit_date = models.DateTimeField(db_index=True)
    
    class Meta:
        verbose_name_plural = "GatePass List View (Read Pool)"
        indexes = [
            models.Index(fields=['tenant_id', 'status', '-exit_date']),
            models.Index(fields=['registration_num', 'status']),
        ]

class ComplaintSummary(CampusBaseModel):
    """
    Pre-calculated departmental snapshots.
    """
    category = models.CharField(max_length=50, db_index=True)
    total_open = models.PositiveIntegerField(default=0)
    avg_age_hrs = models.FloatField(default=0.0)
    breach_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = "Complaint Summaries"
        unique_together = ('tenant_id', 'category')

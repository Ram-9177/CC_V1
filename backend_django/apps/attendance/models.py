"""Attendance app models for tracking student attendance."""

from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User
from django.utils import timezone
from datetime import date


class Attendance(TimestampedModel):
    """Track daily attendance of students."""
    
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('on_leave', 'On Leave'),
        ('out_gatepass', 'Out (Gatepass)'),
        ('late', 'Late'),
        ('excused', 'Excused'),
        ('sick', 'Sick Leave'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    attendance_date = models.DateField(default=date.today)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    
    # New Fields for hierarchy & locking
    is_locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_locked')
    
    # Denise Denormalization for role-based scope performance
    block = models.ForeignKey('rooms.Building', on_delete=models.SET_NULL, null=True, blank=True)
    floor = models.IntegerField(null=True, blank=True)

    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-attendance_date']
        unique_together = ['user', 'attendance_date']
        indexes = [
            # Student history: user + desc date (personal view)
            models.Index(fields=['user', '-attendance_date'], name='att_user_date_idx'),
            # Bulk mark queries: status alone (mark-all filter)
            models.Index(fields=['status'], name='att_status_idx'),
            # Stats endpoint: date + status aggregate
            models.Index(fields=['attendance_date', 'status'], name='att_date_status_idx'),
            # Warden/HR scoped view: block + date (PRIMARY HOTPATH)
            models.Index(fields=['block', 'attendance_date'], name='att_block_date_idx'),
            # Floor-level drill-down
            models.Index(fields=['block', 'floor', 'attendance_date'], name='att_block_floor_date_idx'),
        ]
        db_table = 'attendance_attendance'
    
    def __str__(self):
        return f"{self.user} - {self.attendance_date} - {self.status}"


class AttendanceReport(TimestampedModel):
    """Monthly/weekly attendance summaries."""
    
    PERIOD_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_reports')
    period = models.CharField(max_length=20, choices=PERIOD_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.IntegerField(default=0)
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    late_days = models.IntegerField(default=0)
    excused_days = models.IntegerField(default=0)
    percentage = models.FloatField(default=0.0)
    
    class Meta:
        ordering = ['-start_date']
        db_table = 'attendance_report'
        indexes = [
            models.Index(fields=['user', 'period']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    
    def __str__(self):
        return f"{self.user} - {self.period} - {self.start_date} to {self.end_date}"

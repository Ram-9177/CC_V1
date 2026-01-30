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
        ('late', 'Late'),
        ('excused', 'Excused'),
        ('sick', 'Sick Leave'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    attendance_date = models.DateField(default=date.today)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-attendance_date']
        unique_together = ['user', 'attendance_date']
        indexes = [models.Index(fields=['user', '-attendance_date'])]
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
    
    def __str__(self):
        return f"{self.user} - {self.period} - {self.start_date} to {self.end_date}"

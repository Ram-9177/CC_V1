"""Gate scans app models."""

from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User


class GateScan(TimestampedModel):
    """Log of gate scans for security (alternative implementation)."""
    
    DIRECTION_CHOICES = [
        ('in', 'Entry'),
        ('out', 'Exit'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gate_scans_log')
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    scan_time = models.DateTimeField(auto_now_add=True)
    qr_code = models.CharField(max_length=500)
    location = models.CharField(max_length=100, blank=True)
    verified = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-scan_time']
        indexes = [
            # Per-student scan history (most frequent lookup)
            models.Index(fields=['student', '-scan_time'], name='gsc_student_time_idx'),
            # Direction filter for entry/exit reports
            models.Index(fields=['direction', '-scan_time'], name='gsc_direction_time_idx'),
            # Verification status filter
            models.Index(fields=['verified', '-scan_time'], name='gsc_verified_time_idx'),
        ]
        db_table = 'gate_scans_gatescan'
    
    def __str__(self):
        return f"{self.student} - {self.direction} - {self.scan_time}"

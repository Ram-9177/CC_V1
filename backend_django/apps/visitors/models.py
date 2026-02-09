"""Models for Visitors app."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class VisitorLog(TimestampedModel):
    """Model for tracking visitors."""
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='visitors')
    visitor_name = models.CharField(max_length=100)
    relationship = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    purpose = models.TextField()
    check_in = models.DateTimeField(auto_now_add=True)
    check_out = models.DateTimeField(null=True, blank=True)
    id_proof_number = models.CharField(max_length=50, help_text="Last 4 digits of ID proof")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-check_in']
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['visitor_name']),
            models.Index(fields=['check_in']),
        ]

    def __str__(self):
        return f"{self.visitor_name} -> {self.student.username}"

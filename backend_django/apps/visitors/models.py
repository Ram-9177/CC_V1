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
    photo_url = models.URLField(blank=True, help_text="Photo URL of the visitor")
    pre_registration = models.ForeignKey(
        'VisitorPreRegistration', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='visitor_logs', help_text="Linked pre-registration if any"
    )

    class Meta:
        ordering = ['-check_in']
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['visitor_name']),
            models.Index(fields=['check_in']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.visitor_name} -> {self.student.username}"


class VisitorPreRegistration(TimestampedModel):
    """Students can pre-register expected visitors for faster check-in."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('checked_in', 'Checked In'),
        ('expired', 'Expired'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='visitor_pre_registrations')
    visitor_name = models.CharField(max_length=100)
    relationship = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    purpose = models.TextField()
    expected_date = models.DateField(help_text="Expected date of visit")
    expected_time = models.TimeField(null=True, blank=True, help_text="Expected arrival time")
    id_proof_number = models.CharField(max_length=50, blank=True, help_text="Last 4 digits of ID proof")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='visitor_approvals'
    )
    rejection_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-expected_date', '-created_at']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['expected_date', 'status']),
        ]
    
    def __str__(self):
        return f"Pre-reg: {self.visitor_name} for {self.student.username} on {self.expected_date}"

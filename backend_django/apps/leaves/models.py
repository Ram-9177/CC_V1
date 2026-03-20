"""Models for Leave Application system."""
from django.db import models
from django.core.exceptions import ValidationError
from core.models import TimestampedModel
from apps.auth.models import User


class LeaveApplication(TimestampedModel):
    """Leave application model for students."""

    LEAVE_TYPE_CHOICES = [
        ('sick', 'Sick Leave'),
        ('personal', 'Personal Leave'),
        ('vacation', 'Vacation'),
        ('emergency', 'Emergency Leave'),
        ('academic', 'Academic Leave'),
        ('family', 'Family Event'),
    ]

    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leave_applications', db_index=True,
    )
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='leave_applications',
        limit_choices_to={'role': 'student'},
    )
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_APPROVAL')

    # Approval workflow
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leaves_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Parent/guardian awareness
    parent_informed = models.BooleanField(default=False, help_text="Whether parent/guardian has been informed")
    parent_contact = models.CharField(max_length=15, blank=True, help_text="Parent contact number")

    # Destination and contact
    destination = models.CharField(max_length=255, blank=True, help_text="Where the student will go")
    contact_during_leave = models.CharField(max_length=15, blank=True, help_text="Contact number during leave")

    # Attachments (e.g., medical certificate)
    attachment_url = models.URLField(blank=True, help_text="URL for supporting document")
    notes = models.TextField(blank=True, help_text="Additional notes from student or approver")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['status', 'start_date']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def clean(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'End date cannot be before start date.'})

    @property
    def duration_days(self):
        """Number of days of leave."""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0

    def __str__(self):
        return f"{self.student.username} - {self.leave_type} ({self.start_date} to {self.end_date})"

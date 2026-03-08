from django.db import models
from django.conf import settings
from core.models import TimestampedModel

class AuditLog(TimestampedModel):
    """
    Enterprise-grade audit log for tracking critical record changes.
    Tracks Who, When, What changed, Old/New values, and Context (IP/UA).
    """
    ACTION_CHOICES = [
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
        ('APPROVE', 'Approved'),
        ('REJECT', 'Rejected'),
        ('SCAN', 'Scanned'),
        ('RESOLVE', 'Resolved'),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_actions'
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=100, help_text="e.g. GatePass, Attendance")
    resource_id = models.CharField(max_length=100)
    
    # Store changes as JSON - more flexible than multiple columns
    changes = models.JSONField(
        default=dict,
        help_text="Format: { 'field': [old_value, new_value] }"
    )
    
    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['actor', '-created_at']),
            models.Index(fields=['-created_at']),
        ]
        db_table = 'audit_log'

    def __str__(self):
        return f"{self.actor} - {self.action} - {self.resource_type}({self.resource_id})"

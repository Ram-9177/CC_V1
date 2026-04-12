"""Operations app models — Phase 9 (Scaling Backbone)."""

from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class BulkUserJob(TimestampedModel):
    """Lifecycle of a bulk user upload session."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_uploads')
    file_name = models.CharField(max_length=255)
    total_rows = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_log = models.JSONField(default=list, blank=True, help_text="List of errors per row")
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.CASCADE, related_name='bulk_jobs'
    )

    class Meta:
        db_table = 'ops_bulk_job'
        ordering = ['-created_at']

    def __str__(self):
        return f"BulkJob #{self.id} ({self.status})"

class SystemConfig(TimestampedModel):
    """Enterprise-wide configuration registry (JSON-based flags)."""
    
    key = models.CharField(max_length=100, unique=True, help_text="Config identifier (e.g. SLA_HOURS_COMPLAINT)")
    value = models.JSONField(help_text="Standardized value — string, number, or object")
    description = models.TextField(blank=True)
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.CASCADE, related_name='configs', null=True, blank=True
    )

    class Meta:
        db_table = 'ops_system_config'
        verbose_name = "System Configuration"

    def __str__(self):
        return f"{self.key}: {self.value}"

class AuditAction(TimestampedModel):
    """Operational audit trail for sensitive administrative actions."""
    
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ops_audit_actions')
    action = models.CharField(max_length=50, help_text="e.g. ROLE_CHANGE, BULK_UPLOAD, CONFIG_UPDATE")
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100)
    
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'ops_audit_action'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor} - {self.action} on {self.entity_type}({self.entity_id})"

"""Health check app models."""

from django.db import models
from core.models import TimestampedModel


class HealthCheck(TimestampedModel):
    """Model for health check logs."""
    
    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
    ]
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    database_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    cache_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    websocket_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    response_time_ms = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'health_check'
    
    def __str__(self):
        return f"Health - {self.status} - {self.created_at}"

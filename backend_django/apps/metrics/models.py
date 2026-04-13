"""Metrics app models."""

from django.db import models
from core.models import TimestampedModel


class Metric(TimestampedModel):
    """Model for system metrics.

    Tenant safety: ``tenant_id`` may be unset on historical rows. Do not add a blind
    ``filter(tenant_id=…)`` on list endpoints without a data backfill — see
    ``MetricViewSet`` docstring and run ``audit_tenant_scoping`` for review.
    """
    
    METRIC_TYPES = [
        ('occupancy', 'Occupancy Rate'),
        ('attendance', 'Attendance Rate'),
        ('meal_satisfaction', 'Meal Satisfaction'),
        ('api_response_time', 'API Response Time'),
        ('active_users', 'Active Users'),
    ]
    
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    value = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [models.Index(fields=['metric_type', '-timestamp'])]
        db_table = 'metrics_metric'
    
    def __str__(self):
        return f"{self.metric_type} - {self.value}"

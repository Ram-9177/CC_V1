"""Colleges app models."""

from django.db import models
from core.models import TimestampedModel


class College(TimestampedModel):
    """Model for colleges/universities."""
    
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=50, unique=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(
        default=True,
        help_text="When disabled, all users of this college are locked out of the system."
    )
    disabled_reason = models.CharField(
        max_length=500, blank=True, default='',
        help_text="Optional message shown to users when their college is disabled."
    )
    
    class Meta:
        ordering = ['name']
        db_table = 'colleges_college'
    
    def __str__(self):
        status = '' if self.is_active else ' [DISABLED]'
        return f"{self.name}{status}"
